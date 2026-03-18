"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

export type AreaOption = {
  id: string;
  slug: string;
  name: {
    en: string;
    ar: string;
  };
};

type AreaSearchFieldProps = {
  locale: "en" | "ar";
  options?: AreaOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  allLabel?: string;
  searchPlaceholder: string;
  emptyMessage: string;
  clearLabel: string;
  variant?: "surface" | "plain";
};

const variantClasses = {
  surface: {
    input:
      "border border-[var(--jinka-border)] bg-[var(--jinka-surface-muted)] px-4 py-3 text-sm text-[var(--jinka-text)] outline-none transition focus:border-[var(--jinka-accent)]",
    panel:
      "border border-[var(--jinka-border)] bg-[var(--jinka-surface)] shadow-[var(--jinka-shadow)]",
    option:
      "text-[var(--jinka-text)] hover:bg-[var(--jinka-surface-muted)]",
    chip:
      "bg-[var(--jinka-surface-muted)] text-[var(--jinka-text)]",
    button:
      "text-[var(--jinka-muted)] hover:text-[var(--jinka-text)]"
  },
  plain: {
    input: "rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-900 outline-none focus:border-stone-950",
    panel: "rounded-2xl border border-stone-300 bg-white shadow-xl shadow-stone-200/70",
    option: "text-stone-900 hover:bg-stone-100",
    chip: "bg-stone-100 text-stone-800",
    button: "text-stone-500 hover:text-stone-900"
  }
} as const;

function toArray(value: string | string[]) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function mergeOptions(current: AreaOption[], incoming: AreaOption[]) {
  const bySlug = new Map(current.map((area) => [area.slug, area]));

  for (const area of incoming) {
    bySlug.set(area.slug, area);
  }

  return [...bySlug.values()];
}

export function AreaSearchField({
  locale,
  options = [],
  value,
  onChange,
  multiple = false,
  allLabel,
  searchPlaceholder,
  emptyMessage,
  clearLabel,
  variant = "surface"
}: AreaSearchFieldProps) {
  const styles = variantClasses[variant];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedValues = useMemo(() => toArray(value), [value]);
  const [knownOptions, setKnownOptions] = useState<AreaOption[]>(options);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AreaOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const deferredQuery = useDeferredValue(query.trim());

  useEffect(() => {
    setKnownOptions((current) => mergeOptions(current, options));
  }, [options]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    let active = true;

    async function searchAreas() {
      if (!deferredQuery) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const response = await fetch(`/api/areas?q=${encodeURIComponent(deferredQuery)}`, {
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Area lookup failed");
        }

        const payload = (await response.json()) as AreaOption[];
        if (!active) {
          return;
        }

        setKnownOptions((current) => mergeOptions(current, payload));
        setResults(payload);
      } catch {
        if (active) {
          setResults([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void searchAreas();

    return () => {
      active = false;
    };
  }, [deferredQuery]);

  useEffect(() => {
    const missing = selectedValues.filter((slug) => !knownOptions.some((area) => area.slug === slug));

    if (missing.length === 0) {
      return;
    }

    let active = true;

    async function loadMissingAreas() {
      const payloads = await Promise.all(
        missing.map(async (slug) => {
          const response = await fetch(`/api/areas?q=${encodeURIComponent(slug)}`, {
            cache: "no-store"
          });

          if (!response.ok) {
            return [];
          }

          const payload = (await response.json()) as AreaOption[];
          return payload.filter((area) => area.slug === slug);
        })
      );

      if (!active) {
        return;
      }

      setKnownOptions((current) => mergeOptions(current, payloads.flat()));
    }

    void loadMissingAreas();

    return () => {
      active = false;
    };
  }, [knownOptions, selectedValues]);

  const selectedOptions = useMemo(
    () =>
      selectedValues.map((slug) => knownOptions.find((area) => area.slug === slug) ?? {
        id: slug,
        slug,
        name: {
          en: slug,
          ar: slug
        }
      }),
    [knownOptions, selectedValues]
  );

  const visibleOptions = useMemo(() => {
    if (deferredQuery) {
      return results.filter((area) => !selectedValues.includes(area.slug));
    }

    return knownOptions.filter((area) => !selectedValues.includes(area.slug)).slice(0, 12);
  }, [deferredQuery, knownOptions, results, selectedValues]);

  function selectArea(area: AreaOption) {
    if (multiple) {
      onChange([...selectedValues, area.slug]);
      setQuery("");
      setResults([]);
      setIsOpen(true);
      return;
    }

    onChange(area.slug);
    setQuery(area.name[locale]);
    setResults([]);
    setIsOpen(false);
  }

  function removeArea(slug: string) {
    if (multiple) {
      onChange(selectedValues.filter((value) => value !== slug));
      return;
    }

    onChange("");
    setQuery("");
  }

  return (
    <div className="relative" ref={containerRef}>
      {multiple && selectedOptions.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedOptions.map((area) => (
            <button
              key={area.slug}
              type="button"
              onClick={() => removeArea(area.slug)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${styles.chip}`}
            >
              <span>{area.name[locale]}</span>
              <span aria-hidden="true">x</span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <input
          value={!multiple && !query && selectedOptions[0] ? selectedOptions[0].name[locale] : query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);

            if (!multiple && selectedValues.length > 0 && event.target.value !== selectedOptions[0]?.name[locale]) {
              onChange("");
            }
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={multiple ? searchPlaceholder : selectedValues.length > 0 ? undefined : allLabel ?? searchPlaceholder}
          className={`w-full ${styles.input} ${variant === "surface" ? "" : "pr-24"}`}
        />
        {!multiple && selectedValues.length > 0 ? (
          <button
            type="button"
            onClick={() => removeArea(selectedValues[0])}
            className={`absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium ${styles.button}`}
          >
            {clearLabel}
          </button>
        ) : null}
      </div>
      {isOpen ? (
        <div className={`absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl ${styles.panel}`}>
          {!multiple && allLabel ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange("");
                setQuery("");
                setResults([]);
                setIsOpen(false);
              }}
              className={`block w-full px-4 py-3 text-left text-sm ${styles.option}`}
            >
              {allLabel}
            </button>
          ) : null}
          {visibleOptions.map((area) => (
            <button
              key={area.slug}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectArea(area)}
              className={`block w-full px-4 py-3 text-left text-sm ${styles.option}`}
            >
              {area.name[locale]}
            </button>
          ))}
          {!loading && visibleOptions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-stone-500">{emptyMessage}</div>
          ) : null}
          {loading ? <div className="px-4 py-3 text-sm text-stone-500">Searching...</div> : null}
        </div>
      ) : null}
    </div>
  );
}
