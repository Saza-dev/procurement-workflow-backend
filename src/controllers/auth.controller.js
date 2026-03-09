import { prisma } from "../config/db.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/generateToken.js";

// Create User (Signup)
const createUser = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // 1. Check if user exists first
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 2. Hash password only after we know the user is new
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Prisma requires the 'data' property
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
      },
    });

    return res.status(201).json({
      status: "Success",
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
        },
      },
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server Error", error: error.message });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate token (Ensure this function handles setting the cookie if that's your strategy)
    const token = generateToken(user.id, res);



    return res.status(200).json({
      status: "Success",
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};

// Logout
const logout = async (req, res) => {
  // Clearing the cookie
  res.cookie("jwt", "", {
    httpOnly: true,
    expires: new Date(0),
  });

  return res
    .status(200)
    .json({ status: "success", message: "Logged out successfully" });
};

// Current user
const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      status: "Success",
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error" });
  }
};

export { login, logout, getMe, createUser };
