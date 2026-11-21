export default function SplashScreen() {
  // Dominant red sampled from the original logo.jpg background.
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "#C80503" }}
    >
      <img
        src="/logo-splash-transparent.png"
        alt="Root ProjX"
        className="w-64 max-w-xs animate-pulse"
        style={{ objectFit: "contain" }}
      />
    </div>
  );
}
