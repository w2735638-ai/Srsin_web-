import { SiteHeader } from "@/components/LibraryChrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation } from "wouter";

// Hosting answers this path with HTTP 404 while still serving the app.
const NOT_FOUND_PATH = "/404";

// Render for unknown routes and for items the server confirmed missing (e.g. `/page/:id`).
// The redirect is irreversible: never render while loading, on other errors, or before auth resolves.
export default function NotFound() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.appendChild(robots);

    // Full-page navigation: a client-side route change sends no request, so no 404 status.
    if (window.location.pathname.replace(/\/$/, "") !== NOT_FOUND_PATH) {
      window.location.replace(NOT_FOUND_PATH);
    }

    return () => robots.remove();
  }, []);

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <>
      <SiteHeader />
      <main className="not-found-page w-full flex items-center justify-center">
        <Card className="not-found-card w-full max-w-lg mx-4 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-8 pb-8 text-center">
            <Link href="/" className="not-found-brand">Sʀꜱɪɴ ᴡᴇʙ</Link>
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-red-100 rounded-full animate-pulse" />
                <AlertCircle className="relative h-16 w-16 text-red-500" />
              </div>
            </div>

            <h1 className="text-4xl font-bold text-slate-900 mb-2">404</h1>

            <h2 className="text-xl font-semibold text-slate-700 mb-4">
              Page Not Found
            </h2>

            <p className="text-slate-600 mb-8 leading-relaxed">
              Sorry, the page you are looking for doesn't exist.
              <br />
              It may have been moved or deleted.
            </p>

            <div
              id="not-found-button-group"
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <Button
                onClick={handleGoHome}
                className="not-found-home-button px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
