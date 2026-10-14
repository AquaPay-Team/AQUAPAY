function getHealth(req, res) {
  res.status(200).json({
    success: true,
    message: "AquaPay is running"
  });
}

module.exports = { getHealth };

