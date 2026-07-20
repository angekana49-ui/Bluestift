import React from "react";

type RevealProps = {
  children: React.ReactNode;
  delay?: number;
  className?: string;
};

export default function Reveal({ children, delay = 0, className = "" }: RevealProps) {
  return (
    <div className={className.trim()} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
