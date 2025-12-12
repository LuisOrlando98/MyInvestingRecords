export const fmtColor = (value, classes = {}) => {
  const {
    positive = "text-emerald-600",
    negative = "text-red-600",
    neutral = "text-slate-500",
  } = classes;

  if (value > 0) return positive;
  if (value < 0) return negative;
  return neutral;
};

export const fmtSigned = (value, digits = 2) => {
  if (value == null || Number.isNaN(value)) return "--";
  const numericValue = Number(value);
  const sign = numericValue > 0 ? "+" : "";
  return `${sign}${numericValue.toFixed(digits)}`;
};