import type { SVGProps } from "react";

export default function TicketPlusIcon({
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <g clipPath="url(#ticket-plus-clip)">
        <path d="M12.5 4.16663V5.83329" />
        <path d="M12.5 9.16663V10.8333" />
        <path d="M16.3215 8.82145C16.6341 8.50889 17.058 8.33329 17.5 8.33329V5.83329C17.5 5.39127 17.3244 4.96734 17.0118 4.65478C16.6993 4.34222 16.2754 4.16663 15.8333 4.16663H4.16667C3.72464 4.16663 3.30072 4.34222 2.98816 4.65478C2.67559 4.96734 2.5 5.39127 2.5 5.83329V8.33329C2.94203 8.33329 3.36595 8.50889 3.67851 8.82145C3.99107 9.13401 4.16667 9.55793 4.16667 9.99996C4.16667 10.442 3.99107 10.8659 3.67851 11.1785C3.36595 11.491 2.94203 11.6666 2.5 11.6666V14.1666C2.5 14.6087 2.67559 15.0326 2.98816 15.3451C3.30072 15.6577 3.72464 15.8333 4.16667 15.8333H9.58333" />
        <path d="M13.333 15.8334H18.333" />
        <path d="M15.833 13.3334V18.3334" />
      </g>
      <defs>
        <clipPath id="ticket-plus-clip">
          <rect width="20" height="20" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}
