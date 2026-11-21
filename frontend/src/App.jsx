import React from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./features/auth";
import AppRoutes from "./routes/AppRoutes";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
