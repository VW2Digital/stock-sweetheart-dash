import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { captureResellerFromUrl } from "@/lib/reseller";

export default function ResellerCapture() {
  const location = useLocation();
  useEffect(() => {
    captureResellerFromUrl();
  }, [location.search]);
  return null;
}