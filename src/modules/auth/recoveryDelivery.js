module.exports = {
  isConfigured() {
    return false;
  },
  async sendPasswordReset() {
    throw new Error("No approved password recovery provider is configured");
  },
  async sendPasswordChanged() {
    throw new Error("No approved password recovery provider is configured");
  }
};
