import { api } from './api';


export const PayOSService = {
  createPayment: async (paymentData) => {
    console.log(paymentData);
    
    try {
      const response = await api.post(`/payos/create`, {
        orderCode: paymentData.orderCode,
        amount: paymentData.amount,
        description: paymentData.description,
        returnUrl: paymentData.returnUrl,
        cancelUrl: paymentData.cancelUrl,
      });
      return response.data;
    } catch (error) {
      console.error("Error creating PayOS payment:", error);
      throw error;
    }
  },

  verifyPayment: async (orderCode) => {
    try {
      const response = await api.post(`/payos/status`, {
        orderCode: orderCode,
      });
      return response.data;
    } catch (error) {
      console.error("Error verifying PayOS payment:", error);
      throw error;
    }
  },
};
