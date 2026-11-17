"use client";
import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Breadcrumb from "../Common/Breadcrumb";
import CustomSelect from "./CustomSelect";
import CategoryDropdown from "./CategoryDropdown";
import SizeDropdown from "./SizeDropdown";
import ColorsDropdwon from "./ColorsDropdwon";
import PriceDropdown from "./PriceDropdown";
import shopData from "../Shop/shopData";
import SingleGridItem from "../Shop/SingleGridItem";
import { fetchProducts, fetchCategories, StoreCategory } from "@/lib/storefront";
import { Product } from "@/types/product";
import { useLanguage } from "@/app/context/LanguageContext";

const PAGE_SIZE = 12;

const ShopWithSidebarContent = () => {
  const [productSidebar, setProductSidebar] = useState(false);
  const [, setStickyMenu] = useState(false);
  const { isArabic, language } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeCategory = searchParams.get("category") || "";
  const searchTerm = (searchParams.get("search") || "").trim();
  const [products, setProducts] = useState<Product[]>([]);
  const [dbCategories, setDbCategories] = useState<StoreCategory[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState(searchParams.get("sort") || "latest");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const [priceBounds, setPriceBounds] = useState<{ min: number; max: number } | null>(null);
  const [priceValue, setPriceValue] = useState<{ from: number; to: number } | null>(null);
  const [appliedPrice, setAppliedPrice] = useState<{ from: number; to: number } | null>(null);
  const [sizeOptions, setSizeOptions] = useState<string[]>([]);
  const [colorOptions, setColorOptions] = useState<{ value: string; hex: string | null }[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);

  // reset to first page (and clear filters) whenever the category changes
  useEffect(() => {
    setPriceValue(null);
    setAppliedPrice(null);
    setSelectedSizes([]);
    setSelectedColors([]);
  }, [activeCategory]);

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) => (prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]));
  };

  const toggleColor = (color: string) => {
    setSelectedColors((prev) => (prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]));
  };

  const clearAllFilters = () => {
    setPriceValue(null);
    setAppliedPrice(null);
    setSelectedSizes([]);
    setSelectedColors([]);
    selectCategory("");
  };

  // debounce the live slider value before applying it as a filter
  useEffect(() => {
    if (!priceValue) return;
    const t = setTimeout(() => {
      setAppliedPrice(priceValue);
    }, 400);
    return () => clearTimeout(t);
  }, [priceValue]);

  // Infinite scroll: any filter/sort change reloads page 1; reaching the end
  // of the grid appends the next page.
  const loadPage = useCallback(
    async (target: number, signal?: AbortSignal) => {
      const id = ++requestId.current;
      const hasFilters = !!searchTerm || !!appliedPrice || selectedSizes.length > 0 || selectedColors.length > 0;
      if (target === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await fetchProducts({
          page: target,
          pageSize: PAGE_SIZE,
          category: activeCategory,
          search: searchTerm,
          language,
          minPrice: appliedPrice?.from,
          maxPrice: appliedPrice?.to,
          sizes: selectedSizes,
          colors: selectedColors,
          sort,
          signal,
        });
        if (id !== requestId.current) return;
        if (target === 1) {
          const list = res.products.length ? res.products : !activeCategory && !hasFilters ? shopData : [];
          setProducts(list);
          setTotal(res.total || list.length);
          if (res.priceMin != null && res.priceMax != null) {
            const min = Math.floor(res.priceMin);
            const max = Math.ceil(res.priceMax);
            setPriceBounds((prev) => (prev && prev.min === min && prev.max === max ? prev : { min, max }));
          }
          setSizeOptions(res.sizes);
          setColorOptions(res.colors);
        } else {
          setProducts((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            return [...prev, ...res.products.filter((p) => !seen.has(p.id))];
          });
        }
        setTotalPages(Math.max(1, res.totalPages || 1));
        setPage(target);
      } catch {
        if (id !== requestId.current || signal?.aborted) return;
        if (target === 1) {
          const hasAny = !!activeCategory || hasFilters;
          setProducts(hasAny ? [] : shopData);
          setTotal(hasAny ? 0 : shopData.length);
          setTotalPages(1);
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [language, activeCategory, searchTerm, appliedPrice, selectedSizes, selectedColors, sort],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadPage(1, controller.signal);
    return () => controller.abort();
  }, [loadPage]);

  const hasMore = page < totalPages;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore) loadPage(page + 1);
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadingMore, page, loadPage]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCategories({ language, parentOnly: true, signal: controller.signal })
      .then((cats) => setDbCategories(cats))
      .catch(() => setDbCategories([]));
    return () => controller.abort();
  }, [language]);

  const selectCategory = (slug: string) => {
    setProductSidebar(false);
    router.push(slug ? `/shop?category=${encodeURIComponent(slug)}` : "/shop", { scroll: false });
  };

  const handleStickyMenu = () => {
    if (window.scrollY >= 80) {
      setStickyMenu(true);
    } else {
      setStickyMenu(false);
    }
  };

  const options = isArabic
    ? [
        { label: "الأحدث", value: "latest" },
        { label: "الأكثر مبيعاً", value: "bestseller" },
        { label: "السعر: من الأقل", value: "price-asc" },
        { label: "السعر: من الأعلى", value: "price-desc" },
        { label: "الأقدم", value: "oldest" },
      ]
    : [
        { label: "Latest", value: "latest" },
        { label: "Best selling", value: "bestseller" },
        { label: "Price: low to high", value: "price-asc" },
        { label: "Price: high to low", value: "price-desc" },
        { label: "Oldest", value: "oldest" },
      ];

  const fallbackCategories = isArabic
    ? [
        { name: "فساتين البنات", products: 3, slug: "" },
        { name: "فساتين النساء", products: 2, slug: "" },
        { name: "فساتين السهرة", products: 1, slug: "" },
        { name: "ملابس الأطفال", products: 1, slug: "" },
        { name: "طقم الأم والبنت", products: 1, slug: "" },
        { name: "الإكسسوارات", products: 0, slug: "" },
      ]
    : [
        { name: "Girls' Dresses", products: 3, slug: "" },
        { name: "Women's Dresses", products: 2, slug: "" },
        { name: "Evening Wear", products: 1, slug: "" },
        { name: "Baby Collection", products: 1, slug: "" },
        { name: "Mom & Mini", products: 1, slug: "" },
        { name: "Accessories", products: 0, slug: "" },
      ];

  const categories =
    dbCategories.length > 0
      ? dbCategories.map((c) => ({
          name: c.title,
          products: c.products,
          slug: c.slug,
        }))
      : fallbackCategories;

  useEffect(() => {
    window.addEventListener("scroll", handleStickyMenu);
    return () => window.removeEventListener("scroll", handleStickyMenu);
  }, []);

  useEffect(() => {
    if (productSidebar) {
      document.body.classList.add("overflow-hidden", "xl:overflow-auto");
    } else {
      document.body.classList.remove("overflow-hidden", "xl:overflow-auto");
    }
    return () => document.body.classList.remove("overflow-hidden", "xl:overflow-auto");
  }, [productSidebar]);

  return (
    <>
      <Breadcrumb
        title={isArabic ? "المتجر" : "Shop"}
        pages={isArabic ? ["المتجر"] : ["shop"]}
      />

      {/* Mobile backdrop */}
      <div
        onClick={() => setProductSidebar(false)}
        className={`xl:hidden fixed inset-0 z-[9998] bg-dark/50 transition-opacity duration-300 ${
          productSidebar ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      <section className="overflow-hidden relative pb-20 pt-5 lg:pt-12 xl:pt-16 bg-white">
        <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
          <div className="flex gap-7.5">
            {/* Sidebar */}
            <div
              className={`sidebar-content fixed xl:static top-0 left-0 z-[9999] xl:z-auto h-full xl:h-auto max-w-[300px] xl:max-w-[270px] w-full bg-white xl:bg-transparent overflow-y-auto xl:overflow-visible p-5 xl:p-0 ease-out duration-300 ${
                productSidebar ? "translate-x-0" : "-translate-x-full xl:translate-x-0"
              }`}
            >
              {/* Close header — mobile only */}
              <div className="xl:hidden flex items-center justify-between mb-5 pb-4 border-b border-gray-3">
                <span className="font-semibold text-dark text-base">{isArabic ? "الفلاتر" : "Filters"}</span>
                <button
                  onClick={() => setProductSidebar(false)}
                  aria-label={isArabic ? "إغلاق" : "Close"}
                  className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-1 text-dark-4 hover:text-dark transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              <form onSubmit={(e) => e.preventDefault()}>
                <div className="flex flex-col gap-6">
                  {/* <!-- filter box --> */}
                  <div className="bg-white shadow-1 rounded-lg py-4 px-5">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-dark">{isArabic ? "الفلاتر:" : "Filters:"}</p>
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="text-blue hover:underline"
                      >
                        {isArabic ? "مسح الكل" : "Clear All"}
                      </button>
                    </div>
                  </div>

                  {/* <!-- category box --> */}
                  <CategoryDropdown
                    categories={categories}
                    activeSlug={activeCategory}
                    onSelect={selectCategory}
                    label={isArabic ? "الفئة" : "Category"}
                  />

                  {/* // <!-- size box --> */}
                  <SizeDropdown
                    title={isArabic ? "المقاس" : "Size"}
                    emptyLabel={isArabic ? "لا توجد مقاسات" : "No sizes available"}
                    options={sizeOptions}
                    selected={selectedSizes}
                    onToggle={toggleSize}
                  />

                  {/* // <!-- color box --> */}
                  <ColorsDropdwon
                    title={isArabic ? "الألوان" : "Colors"}
                    emptyLabel={isArabic ? "لا توجد ألوان" : "No colors available"}
                    options={colorOptions}
                    selected={selectedColors}
                    onToggle={toggleColor}
                  />

                  {/* // <!-- price range box --> */}
                  <PriceDropdown
                    title={isArabic ? "السعر" : "Price"}
                    currency={isArabic ? "ر.ع." : "OMR"}
                    min={priceBounds?.min ?? 0}
                    max={priceBounds?.max ?? 100}
                    value={priceValue ?? { from: priceBounds?.min ?? 0, to: priceBounds?.max ?? 100 }}
                    onChange={(from, to) => setPriceValue({ from, to })}
                  />
                </div>
              </form>
            </div>
            {/* // <!-- Sidebar End --> */}

            {/* // <!-- Content Start --> */}
            <div className="xl:max-w-[870px] w-full">
              <div className="rounded-lg bg-white shadow-1 ps-3 pe-2.5 py-2.5 mb-6">
                <div className="flex items-center justify-between">
                  {/* top bar left */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Filters open button — mobile/tablet only */}
                    <button
                      onClick={() => setProductSidebar(true)}
                      className="xl:hidden flex items-center gap-2 h-9 px-3.5 rounded-lg border border-gray-3 bg-gray-1 text-sm font-medium text-dark hover:border-blue hover:text-blue transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                        <path d="M3 6H21M7 12H17M11 18H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                      {isArabic ? "الفلاتر" : "Filters"}
                    </button>

                    <CustomSelect options={options} value={sort} onChange={setSort} />

                    <p className="hidden sm:block">
                      {isArabic ? (
                        <>
                          <span className="text-dark">{products.length}</span> من {total} منتج
                        </>
                      ) : (
                        <>
                          Showing <span className="text-dark">{products.length}</span> of {total} products
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {searchTerm && (
                <div className="flex items-center justify-between gap-3 mb-5">
                  <p className="text-dark text-sm sm:text-base min-w-0 truncate">
                    {isArabic ? "نتائج البحث عن" : "Results for"} <strong>&ldquo;{searchTerm}&rdquo;</strong>
                    <span className="text-dark-4"> · {total}</span>
                  </p>
                  <button type="button" onClick={() => router.push(activeCategory ? `/shop?category=${encodeURIComponent(activeCategory)}` : "/shop", { scroll: false })} className="shrink-0 text-sm text-blue hover:underline">
                    {isArabic ? "مسح البحث" : "Clear search"}
                  </button>
                </div>
              )}
              {/* <!-- Products Grid Tab Content Start --> */}
              {loading ? (
                <div className="flex flex-col items-center justify-center bg-white shadow-1 rounded-lg py-20">
                  <span className="inline-block w-8 h-8 border-2 border-gray-3 border-t-blue rounded-full animate-spin" />
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center bg-white shadow-1 rounded-lg py-20 px-6 text-center">
                  <p className="text-dark font-medium">
                    {isArabic ? "لا توجد منتجات مطابقة" : "No products found"}
                  </p>
                  {activeCategory && (
                    <button
                      type="button"
                      onClick={() => selectCategory("")}
                      className="mt-3 text-blue hover:underline"
                    >
                      {isArabic ? "مسح الفلاتر" : "Clear filters"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-10">
                  {products.map((item, key) => (
                    <SingleGridItem item={item} key={key} />
                  ))}
                </div>
              )}
              {/* <!-- Products Grid Tab Content End --> */}

              {/* Infinite scroll sentinel */}
              {!loading && products.length > 0 && (
                <div ref={sentinelRef} className="flex flex-col items-center justify-center mt-10 min-h-[60px]">
                  {loadingMore ? (
                    <span className="inline-block w-7 h-7 border-2 border-gray-3 border-t-blue rounded-full animate-spin" />
                  ) : hasMore ? (
                    <button type="button" onClick={() => loadPage(page + 1)} className="text-sm font-medium text-blue hover:underline">
                      {isArabic ? "عرض المزيد" : "Load more"}
                    </button>
                  ) : total > PAGE_SIZE ? (
                    <p className="text-sm text-dark-4">{isArabic ? `عرضنا كل المنتجات (${total})` : `You've seen all ${total} products`}</p>
                  ) : null}
                </div>
              )}
            </div>
            {/* // <!-- Content End --> */}
          </div>
        </div>
      </section>
    </>
  );
};

const ShopWithSidebar = () => (
  <Suspense fallback={null}>
    <ShopWithSidebarContent />
  </Suspense>
);

export default ShopWithSidebar;
