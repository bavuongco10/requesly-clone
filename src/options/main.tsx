import React from "react";
import ReactDOM from "react-dom/client";
import "../styles/index.css";

function Options() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Requestly Clone — Options</h1>
      <p className="text-sm text-gray-500">Dashboard scaffold.</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
);
