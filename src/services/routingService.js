/**
 * Routing Service using OSRM (Open Source Routing Machine)
 * Provides real-world distance and duration calculations based on actual roads
 */

class RoutingService {
  constructor() {
    // Using public OSRM demo server - for production, consider self-hosting
    this.baseUrl = 'https://router.project-osrm.org/route/v1/driving'
    this.timeout = 5000 // 5 seconds timeout
  }

  /**
   * Calculate real-world distance and duration between two coordinates
   * @param {number} startLat - Starting latitude
   * @param {number} startLon - Starting longitude  
   * @param {number} endLat - Ending latitude
   * @param {number} endLon - Ending longitude
   * @returns {Promise<{distance: number, duration: number, success: boolean}>}
   */
  async calculateRoute(startLat, startLon, endLat, endLon) {
    try {
      // Format coordinates as required by OSRM: longitude,latitude
      const coordinates = `${startLon},${startLat};${endLon},${endLat}`
      const url = `${this.baseUrl}/${coordinates}?overview=false&alternatives=false&steps=false`
      
      console.log('OSRM API URL:', url)
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`OSRM API error: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No route found')
      }
      
      const route = data.routes[0]
      const distanceKm = route.distance / 1000 // Convert meters to kilometers
      const durationMinutes = route.duration / 60 // Convert seconds to minutes
      
      return {
        success: true,
        distance: distanceKm,
        duration: durationMinutes,
        rawResponse: data
      }
      
    } catch (error) {
      console.error('OSRM routing error:', error)
      return {
        success: false,
        error: error.message,
        distance: null,
        duration: null
      }
    }
  }

  /**
   * Haversine formula fallback for air distance calculation
   * Used when OSRM API is unavailable
   */
  calculateAirDistance(lat1, lon1, lat2, lon2) {
    const R = 6371 // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c // Distance in km
  }

  /**
   * Calculate distance with OSRM only
   * No fallback to air distance - if OSRM fails, return null
   */
  async calculateDistanceWithFallback(startLat, startLon, endLat, endLon) {
    // Try OSRM only
    const osrmResult = await this.calculateRoute(startLat, startLon, endLat, endLon)
    
    if (osrmResult.success) {
      return {
        distance: osrmResult.distance,
        duration: osrmResult.duration,
        method: 'osrm',
        success: true
      }
    }
    
    // No fallback - return null if OSRM fails
    return {
      distance: null,
      duration: null,
      method: 'failed',
      success: false
    }
  }

  /**
   * Batch calculate distances for multiple destinations
   * @param {number} startLat - Starting latitude
   * @param {number} startLon - Starting longitude
   * @param {Array} destinations - Array of {lat, lon} objects
   * @returns {Promise<Array>} Array of distance results
   */
  async calculateMultipleDistances(startLat, startLon, destinations) {
    const results = []
    
    // Process destinations in batches to avoid overwhelming the API
    const batchSize = 5
    for (let i = 0; i < destinations.length; i += batchSize) {
      const batch = destinations.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (dest, index) => {
        const result = await this.calculateDistanceWithFallback(
          startLat, startLon, dest.lat, dest.lon
        )
        return {
          index: i + index,
          ...result
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      
      // Small delay between batches to be respectful to the API
      if (i + batchSize < destinations.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    return results
  }
}

export default new RoutingService()