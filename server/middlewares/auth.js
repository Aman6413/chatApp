import jwt from "jsonwebtoken";
import User from "../models/user.js";

// Middleware to protect routes
const protectedRoute = async (req, res, next) => {
  try {
    const token = req.headers.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select("-password");

    if(!user) res.json({ success: false, error: "Unauthorized access" });
    
    req.user = user;
    next();
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export default protectedRoute;
