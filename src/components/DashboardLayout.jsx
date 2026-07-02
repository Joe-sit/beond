import cloudBackground from "../assets/cloud-background.svg";
import cloudDecorate from "../assets/cloud-decorate.svg";

export default function DashboardLayout({ hero, panel }) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div className="relative overflow-hidden bg-linear-to-b from-[#274670] via-[#7fa3d1] to-slate-50">
        <img
          src={cloudBackground}
          alt=""
          className="pointer-events-none absolute inset-x-0 top-0 w-full opacity-60"
        />
        <img
          src={cloudDecorate}
          alt=""
          className="pointer-events-none absolute right-0 top-0 w-24"
        />
        <div className="relative">{hero}</div>
      </div>
      <div className="bg-white">{panel}</div>
    </div>
  );
}
