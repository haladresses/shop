"use client";
import React from "react";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { AppDispatch, useAppSelector } from "@/redux/store";
import { removeAllItemsFromWishlist } from "@/redux/features/wishlist-slice";
import { useLanguage } from "@/app/context/LanguageContext";
import Breadcrumb from "../Common/Breadcrumb";
import SingleItem from "./SingleItem";

export const Wishlist = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isArabic } = useLanguage();
  const wishlistItems = useAppSelector((state) => state.wishlistReducer.items);

  const copy = isArabic
    ? {
        breadcrumb: "المفضلة",
        title: "قائمة المفضلة",
        clear: "مسح الكل",
        emptyTitle: "قائمة المفضلة فارغة",
        emptyText: "اضغطي على القلب في أي منتج لحفظه هنا.",
        shop: "تابعي التسوق",
      }
    : {
        breadcrumb: "Wishlist",
        title: "Your Wishlist",
        clear: "Clear All",
        emptyTitle: "Your wishlist is empty",
        emptyText: "Tap the heart on any piece to save it here.",
        shop: "Continue shopping",
      };

  return (
    <>
      <Breadcrumb title={copy.breadcrumb} pages={[copy.breadcrumb]} />
      <section className="overflow-hidden py-14 sm:py-20 bg-meta">
        <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
          {wishlistItems.length === 0 ? (
            <div className="max-w-[560px] mx-auto bg-white rounded-xl shadow-1 px-4 py-12 sm:py-16 text-center">
              <p className="font-medium text-dark">{copy.emptyTitle}</p>
              <p className="pt-1 pb-6 text-sm text-dark-4">{copy.emptyText}</p>
              <Link
                href="/shop"
                className="inline-flex justify-center font-medium text-white bg-dark py-3 px-7 rounded-full ease-out duration-200 hover:bg-blue"
              >
                {copy.shop}
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-1 p-4 sm:p-7.5">
              <div className="flex items-center justify-between gap-4 mb-2">
                <h2 className="font-semibold text-dark text-xl">
                  {copy.title} <span className="font-normal text-base text-dark-4">({wishlistItems.length})</span>
                </h2>
                <button
                  type="button"
                  onClick={() => dispatch(removeAllItemsFromWishlist())}
                  className="text-custom-sm text-dark-4 ease-out duration-200 hover:text-red"
                >
                  {copy.clear}
                </button>
              </div>

              <div className="divide-y divide-gray-3">
                {wishlistItems.map((item) => (
                  <SingleItem item={item} key={item.id} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
};
