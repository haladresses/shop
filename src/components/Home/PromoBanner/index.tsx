import React from "react";

const PromoBanner = () => {
  return (
    <section className="overflow-hidden py-20">
      <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
        {/* <!-- promo banner big --> */}
        <div className="relative z-1 overflow-hidden rounded-lg bg-[#F6E5E1] py-12.5 lg:py-17.5 xl:py-22.5 px-4 sm:px-7.5 lg:px-14 xl:px-19 mb-7.5">
          <div className="max-w-[550px] w-full">
            <span className="block font-medium text-xl text-dark mb-3">
              Hala Dresses Retail Edit
            </span>

            <h2 className="font-bold text-xl lg:text-heading-4 xl:text-heading-3 text-dark mb-5">
              Women and kids fashion, chosen for real life and special days.
            </h2>

            <p>
              From daily outfits to celebration looks, Hala Dresses offers retail collections that balance comfort, color, and polished style for families in Oman.
            </p>

            <a
              href="/shop-with-sidebar"
              className="inline-flex font-medium text-custom-sm text-white bg-blue py-[11px] px-9.5 rounded-md ease-out duration-200 hover:bg-blue-dark mt-7.5"
            >
              Browse Collections
            </a>
          </div>
        </div>

        <div className="grid gap-7.5 grid-cols-1 lg:grid-cols-2">
          {/* <!-- promo banner small --> */}
          <div className="relative z-1 overflow-hidden rounded-lg bg-[#EFE7E1] py-10 xl:py-16 px-4 sm:px-7.5 xl:px-10">
            <div className="text-right">
              <span className="block text-lg text-dark mb-1.5">
                Store Timing
              </span>

              <h2 className="font-bold text-xl lg:text-heading-4 text-dark mb-2.5">
                Saturday to Thursday
              </h2>

              <p className="font-semibold text-custom-1 text-teal">
                11AM-1PM and 6PM-8PM
              </p>

              <a
                href="/contact"
                className="inline-flex font-medium text-custom-sm text-white bg-dark py-2.5 px-8.5 rounded-md ease-out duration-200 hover:bg-blue mt-9"
              >
                Visit Us
              </a>
            </div>
          </div>

          {/* <!-- promo banner small --> */}
          <div className="relative z-1 overflow-hidden rounded-lg bg-[#F7EEE8] py-10 xl:py-16 px-4 sm:px-7.5 xl:px-10">
            <div>
              <span className="block text-lg text-dark mb-1.5">
                WhatsApp Orders
              </span>

              <h2 className="font-bold text-xl lg:text-heading-4 text-dark mb-2.5">
                Fast replies on <span className="text-orange">+968 9944 0312</span>
              </h2>

              <p className="max-w-[285px] text-custom-sm">
                Ask about stock, sizing, or your nearest favorite look directly through the Hala Dresses WhatsApp line.
              </p>

              <a
                href="https://api.whatsapp.com/send?phone=96899440312"
                className="inline-flex font-medium text-custom-sm text-white bg-orange py-2.5 px-8.5 rounded-md ease-out duration-200 hover:bg-orange-dark mt-7.5"
              >
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PromoBanner;
