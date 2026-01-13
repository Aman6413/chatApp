import { generateToken } from "../lib/utils.js";
import User from "../models/user.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";

// Signup
export const signup = async (req, res) => {
  try {
    const { fullName, email, password, bio } = req.body;

    if (!fullName || !email || !password || !bio) {
      return res.json({ success: false, error: "All fields are required" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.json({ success: false, error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      fullName,
      email,
      password: hashedPassword,
      bio,
    });

    const token = generateToken(newUser._id);

    const { password: pwd, ...safeUser } = newUser._doc;

    res.json({
      success: true,
      userData: safeUser,
      token,
      message: "User created successfully",
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.json({ success: false, error: "All fields are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ success: false, error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, error: "Invalid credentials" });
    }

    const token = generateToken(user._id);
    const { password: pwd, ...safeUser } = user._doc;

    res.json({
      success: true,
      userData: safeUser,
      token,
      message: "Login successful",
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Check Auth
export const checkAuth = async (req, res) => {
  res.json({ success: true, userData: req.user });
};

// Update Profile
export const updateProfile = async (req, res) => {
  try {
    const { profilePic, fullName, bio } = req.body;
    const userId = req.user._id;

    let updatedUser;

    if (profilePic) {
      const upload = await cloudinary.uploader.upload(profilePic);
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { profilePic: upload.secure_url, fullName, bio },
        { new: true }
      );
    } else {
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { fullName, bio },
        { new: true }
      );
    }

    res.json({
      success: true,
      userData: updatedUser,
      message: "Profile updated successfully",
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
