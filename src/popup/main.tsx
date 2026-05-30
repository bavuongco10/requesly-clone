import React from "react";
import ReactDOM from "react-dom/client";
import "../styles/index.css";

function Popup() {
  return (
    <div className="min-w-[320px] p-4">
      <h1 className="text-lg font-semibold">Requestly Clone</h1>
      <p className="text-sm text-gray-500">Popup scaffold.</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
