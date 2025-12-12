import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const auth = async (req, res, next) => {
  try {

    console.log("LOGIN BODY:", req.body);
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ msg: "No token" });

    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ msg: "User not found" });

    if (user.status === "suspended")
      return res.status(403).json({ msg: "Account suspended" });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ msg: "Invalid token" });
  }
};
