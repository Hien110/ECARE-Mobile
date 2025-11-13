const CLOUD_NAME = "ding6o1pz";        // 👈 thay bằng cloud_name thật
const UPLOAD_PRESET = "ecareproject";  // 👈 preset unsigned

export const uploadCloudinaryService = {

  uploadImage: async (file) => {
    if (!file) {
      return { success: false, message: "Không có file nào được chọn để upload." };
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
      );

      if (!response.ok) {
        throw new Error(`Lỗi HTTP: ${response.status}`);
      }

      const data = await response.json();
      if (data.secure_url) {
        return {
          success: true,
          data: data.secure_url,
          message: "Upload ảnh thành công",
        };
      }

      return { success: false, message: "Upload thành công nhưng không có secure_url" };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Lỗi khi upload ảnh lên Cloudinary",
      };
    }
  },


  uploadMultipleImages: async (files) => {
    if (!files || files.length === 0) {
      return { success: false, data: [], message: "Không có file nào được chọn để upload." };
    }

    const uploadPromises = files.map((file) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);

      return fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData,
      }).then((res) => {
        if (!res.ok) throw new Error(`Lỗi HTTP: ${res.status}`);
        return res.json();
      });
    });

    try {
      const results = await Promise.all(uploadPromises);
      const urls = results.filter((d) => d.secure_url).map((d) => d.secure_url);

      return {
        success: true,
        data: urls,
        message: "Upload nhiều ảnh thành công",
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        message: error.message || "Lỗi khi upload nhiều ảnh lên Cloudinary",
      };
    }
  },


  uploadMultipleFiles: async (files) => {
    if (!files || files.length === 0) {
      return { success: false, data: [], message: "Không có file nào được chọn để upload." };
    }

    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`;

    const uploadPromises = files.map((file) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);

      return fetch(endpoint, {
        method: "POST",
        body: formData,
      }).then((res) => {
        if (!res.ok) throw new Error(`Lỗi HTTP: ${res.status}`);
        return res.json();
      });
    });

    try {
      const results = await Promise.all(uploadPromises);
      const urls = results.filter((d) => d.secure_url).map((d) => d.secure_url);

      return {
        success: true,
        data: urls,
        message: "Upload file thành công",
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        message: error.message || "Lỗi khi upload file lên Cloudinary",
      };
    }
  },
};

export default uploadCloudinaryService;