import { generateToken } from "../lib/utils.js";
import User from "../models/user.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";

// Signup controller
export const signup = async (req, res) => {
    try {
        const { fullName, email, password } = req.body;

        if (!fullName || !email || !password) {
            return res.json({ success: false, error: "All fields are required" });
        }

        const user = await User.findOne({ email });
        if (user) return res.json({ error: "User exists" });

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await new User({
            fullName,
            email,
            password: hashedPassword,
            bio
        });

        const token = generateToken(newUser._id);

        res.json({ success: true, userData: newUser, token, message: "User created successfully" });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// Login controller
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.json({ success, error: "All fields are required" });
        }

        const user = await User.findOne({ email });
        if (!user) return res.json({ success: false, error: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.json({ success: false, error: "Invalid credentials" });

        const token = generateToken(user._id);

        res.json({ success: true, userData: user, token, message: "Login successful" });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};

// Controller to check if user is authenticated
export const checkAuth = async (req, res) => {
    res.json({ success: true, userData: req.user });
};

// Controller to update user profile
export const updateProfile = async (req, res) => {
    try {
        const { profilePic, fullName, bio } = req.body;

        const userId = req.user._id;
        let updateUser;

        if(!profilePic) {
            updateUser = await User.findByIdAndUpdate(
                userId,
                { fullName, bio },
                { new: true }
            );
        } else {
            const upload = await cloudinary.uploader.upload(profilePic);

            updateUser = await User.findByIdAndUpdate(
                userId,
                { profilePic: upload.secure_url, fullName, bio },
                { new: true }
            );
        }

        res.json({ success: true, userData: updateUser, message: "Profile updated successfully" });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }
};
