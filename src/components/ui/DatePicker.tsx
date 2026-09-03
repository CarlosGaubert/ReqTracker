import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

interface DatePickerProps {
  value: string; // Format: "YYYY-MM-DD"
  onChange: (val: string) => void;
  required?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parse initial date or default to today
  const initialDate = value ? new Date(`${value}T00:00:00`) : new Date();
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth()); // 0-indexed

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    // Adjust so Monday is 0 and Sunday is 6 (matching calendar rows)
    return day === 0 ? 6 : day - 1;
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const formattedMonth = String(currentMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const selectedDateStr = `${currentYear}-${formattedMonth}-${formattedDay}`;
    onChange(selectedDateStr);
    setIsOpen(false);
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);
  
  // Days grid
  const daysGrid: (number | null)[] = [];
  // Add empty slots for offset before the first day of the month
  for (let i = 0; i < firstDayIndex; i++) {
    daysGrid.push(null);
  }
  // Add actual days
  for (let d = 1; d <= daysInMonth; d++) {
    daysGrid.push(d);
  }

  // Display formatted date in input
  const displayValue = value ? new Date(`${value}T00:00:00`).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : '';

  return (
    <div className="relative w-full" ref={containerRef}>
      <div 
        className="flex items-center gap-2.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 rounded-xl px-3.5 py-2.5 text-sm h-10 cursor-pointer select-none focus-within:ring-2 focus-within:ring-emerald-500 transition-all hover:bg-neutral-100/60 dark:hover:bg-neutral-800/30"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CalendarIcon className="h-4.5 w-4.5 text-neutral-400" />
        <span className={`text-sm font-medium ${value ? 'text-neutral-900 dark:text-neutral-100' : 'text-neutral-400 dark:text-neutral-500'}`}>
          {displayValue || 'Selecciona una fecha de vencimiento...'}
        </span>
      </div>

      {isOpen && (
        <div className="absolute left-0 mt-2 z-50 p-4 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 rounded-2xl shadow-xl w-[300px] animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between mb-3.5 select-none">
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-lg"
              onClick={handlePrevMonth}
            >
              <ChevronLeft className="h-4.5 w-4.5" />
            </Button>
            <span className="text-sm font-bold text-neutral-800 dark:text-neutral-100">
              {months[currentMonth]} {currentYear}
            </span>
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-lg"
              onClick={handleNextMonth}
            >
              <ChevronRight className="h-4.5 w-4.5" />
            </Button>
          </div>

          {/* Weekdays */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-2 select-none uppercase tracking-wider">
            <span>Lu</span>
            <span>Ma</span>
            <span>Mi</span>
            <span>Ju</span>
            <span>Vi</span>
            <span>Sá</span>
            <span>Do</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {daysGrid.map((day, idx) => {
              if (day === null) {
                return <div key={idx} className="h-8 w-8" />;
              }

              const formattedMonth = String(currentMonth + 1).padStart(2, '0');
              const formattedDay = String(day).padStart(2, '0');
              const thisDateStr = `${currentYear}-${formattedMonth}-${formattedDay}`;
              const isSelected = value === thisDateStr;

              // Check if date is today for a subtle indicator
              const today = new Date();
              const isToday = today.getDate() === day && today.getMonth() === currentMonth && today.getFullYear() === currentYear;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-8 w-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-emerald-500 text-white font-bold hover:bg-emerald-600 shadow-sm'
                      : isToday
                      ? 'border border-emerald-500/50 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-neutral-100 dark:hover:bg-neutral-900'
                      : 'text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
