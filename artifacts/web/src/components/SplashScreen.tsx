export default function SplashScreen() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "#E31C23" }}
    >
      <img
        src="/logo.jpg"
        alt="Root ProjX"
        className="w-64 max-w-xs animate-pulse"
        style={{ objectFit: "contain" }}
      />
    </div>
  );
}
