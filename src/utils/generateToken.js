import jwt from "jsonwebtoken";

export const generateToken = (userId, res) => {

  
  if (!process.env.JWT_SECRET) {
    console.error("ERROR: JWT_SECRET is missing from .env");
    return null;
  }

  try {
    const payload = { id: userId };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });



    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return token;
  } catch (error) {
    console.error("JWT signing failed:", error.message); // Debug 3
    return null;
  }
};
