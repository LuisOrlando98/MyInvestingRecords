export const Card = ({ children }) => (
  <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">{children}</div>
);

export const CardContent = ({ children }) => (
  <div className="space-y-2">{children}</div>
);
