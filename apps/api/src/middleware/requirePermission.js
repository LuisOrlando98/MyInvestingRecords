export const requirePermission = (perm) => {
  return (req, res, next) => {
    if (!req.user.permissions[perm])
      return res.status(403).json({ msg: "Permission denied" });

    next();
  };
};
