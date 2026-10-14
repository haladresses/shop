import React, { useState, useEffect, useRef } from "react";

type Option = { label: string; value: string };

const CustomSelect = ({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [internal, setInternal] = useState(options[0]?.value);
  const selectRef = useRef<HTMLDivElement>(null);
  const current = value ?? internal;
  const selected = options.find((o) => o.value === current) ?? options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const pick = (option: Option) => {
    setInternal(option.value);
    onChange?.(option.value);
    setIsOpen(false);
  };

  return (
    <div className="custom-select custom-select-2 flex-shrink-0 relative" ref={selectRef}>
      <div className={`select-selected whitespace-nowrap ${isOpen ? "select-arrow-active" : ""}`} onClick={() => setIsOpen(!isOpen)}>
        {selected?.label}
      </div>
      <div className={`select-items ${isOpen ? "" : "select-hide"}`}>
        {options
          .filter((o) => o.value !== selected?.value)
          .map((option) => (
            <div key={option.value} onClick={() => pick(option)} className="select-item">
              {option.label}
            </div>
          ))}
      </div>
    </div>
  );
};

export default CustomSelect;
