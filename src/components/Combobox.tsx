import React, { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, Check, X } from "lucide-react";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  hasError?: boolean;
  disabled?: boolean;
}

export const Combobox: React.FC<ComboboxProps> = ({
  options,
  value,
  onChange,
  placeholder = "Seleccionar...",
  emptyMessage = "No se encontraron resultados.",
  hasError = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value) || null;
  }, [options, value]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [options, searchQuery]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Sync searchQuery when dropdown closes or when selected value changes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setActiveIndex(-1);
    } else {
      // When opening, pre-fill query with current selected label and select it
      setSearchQuery(selectedOption ? selectedOption.label : "");
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, selectedOption]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    if (!isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSelectOption = (option: ComboboxOption) => {
    onChange(option.value);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange("");
    setSearchQuery("");
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
          handleSelectOption(filteredOptions[activeIndex]);
        } else if (filteredOptions.length === 1) {
          handleSelectOption(filteredOptions[0]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
      case "Tab":
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  // Determine display value for input when focused vs blurred
  const displayValue = isOpen ? searchQuery : (selectedOption ? selectedOption.label : "");

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger & Input container */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={displayValue}
          onChange={(e) => {
            if (!isOpen) setIsOpen(true);
            setSearchQuery(e.target.value);
            setActiveIndex(-1); // Reset active index on filter change
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={selectedOption ? selectedOption.label : placeholder}
          className={`w-full pr-16 pl-3 py-2 rounded-lg text-white text-sm outline-none border transition-colors cursor-text ${
            disabled ? "opacity-50 cursor-not-allowed bg-[#243340] border-gray-700" :
            hasError ? "border-red-500 bg-[#293C47]" : "border-gray-600 bg-[#293C47] focus:border-[#00aa85]"
          }`}
          style={{ fontFamily: "Alexandria, sans-serif" }}
        />
        
        {/* Action icons (Clear and Toggle Chevron) */}
        <div className="absolute right-2 flex items-center gap-1.5">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-white rounded-full transition-colors hover:bg-white/10"
              title="Limpiar selección"
            >
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={handleToggle}
            disabled={disabled}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronDown
              size={18}
              className={`transform transition-transform duration-200 ${
                isOpen ? "rotate-180 text-[#00aa85]" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Options Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute left-0 right-0 mt-1 rounded-lg border border-gray-600 shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150"
          style={{ backgroundColor: "#22313d" }}
        >
          <ul
            ref={listRef}
            className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-3 text-gray-500 text-xs text-center font-medium">
                {emptyMessage}
              </li>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;
                
                return (
                  <li
                    key={option.value}
                    onClick={() => handleSelectOption(option)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex items-center justify-between px-3 py-2 text-sm rounded-md cursor-pointer transition-colors ${
                      isSelected 
                        ? "bg-[#00aa85]/20 text-white font-semibold" 
                        : isActive 
                        ? "bg-[#00aa85] text-white" 
                        : "text-gray-300 hover:bg-gray-700/50 hover:text-white"
                    }`}
                    style={{ fontFamily: "Alexandria, sans-serif" }}
                  >
                    <span className="truncate pr-4">{option.label}</span>
                    {isSelected && (
                      <Check size={16} className="text-[#00aa85] flex-shrink-0" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
