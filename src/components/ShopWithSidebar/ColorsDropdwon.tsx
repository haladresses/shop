"use client";
import React, { useState } from "react";

type ColorOption = { value: string; hex: string | null };

type ColorsDropdownProps = {
  title: string;
  emptyLabel: string;
  options: ColorOption[];
  selected: string[];
  onToggle: (value: string) => void;
};

const ColorsDropdwon = ({ title, emptyLabel, options, selected, onToggle }: ColorsDropdownProps) => {
  const [toggleDropdown, setToggleDropdown] = useState(true);

  return (
    <div className="bg-white shadow-1 rounded-lg">
      <div
        onClick={() => setToggleDropdown(!toggleDropdown)}
        className={`cursor-pointer flex items-center justify-between py-3 pl-6 pr-5.5 ${toggleDropdown && "shadow-filter"}`}
      >
        <p className="text-dark">{title}</p>
        <button
          aria-label="button for colors dropdown"
          className={`text-dark ease-out duration-200 ${toggleDropdown && "rotate-180"}`}
        >
          <svg className="fill-current" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M4.43057 8.51192C4.70014 8.19743 5.17361 8.161 5.48811 8.43057L12 14.0122L18.5119 8.43057C18.8264 8.16101 19.2999 8.19743 19.5695 8.51192C19.839 8.82642 19.8026 9.29989 19.4881 9.56946L12.4881 15.5695C12.2072 15.8102 11.7928 15.8102 11.5119 15.5695L4.51192 9.56946C4.19743 9.29989 4.161 8.82641 4.43057 8.51192Z"
              fill=""
            />
          </svg>
        </button>
      </div>

      <div className={`flex-wrap gap-3 p-6 ${toggleDropdown ? "flex" : "hidden"}`}>
        {options.length === 0 ? (
          <span className="text-custom-sm text-dark-4">{emptyLabel}</span>
        ) : (
          options.map((color) => {
            const isActive = selected.includes(color.value);
            return (
              <button
                key={color.value}
                type="button"
                title={color.value}
                aria-label={color.value}
                aria-pressed={isActive}
                onClick={() => onToggle(color.value)}
                className={`flex items-center justify-center w-6 h-6 rounded-full border transition-transform duration-200 hover:scale-110 ${
                  isActive ? "border-blue ring-2 ring-blue/30" : "border-gray-3"
                }`}
              >
                <span
                  className="block w-4 h-4 rounded-full border border-black/5"
                  style={{ backgroundColor: color.hex || "#e5e7eb" }}
                />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ColorsDropdwon;
