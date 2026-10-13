function getHealth(req, res) {
  res.status(200).json({
    success: true,
    message: "Fintech KYC API is running"
  });
}

module.exports = { getHealth };
