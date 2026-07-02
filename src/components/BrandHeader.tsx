import logo from "../assets/beond-icon.svg";

export default function BrandHeader() {
  return (
    <div className="px-8 pt-8 md:px-12">
      <img src={logo} alt="beond — Bring Your Bonds Beyond" width={150} height={47} />
    </div>
  );
}
