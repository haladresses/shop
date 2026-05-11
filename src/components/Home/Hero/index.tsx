import React from "react";
import HeroCarousel from "./HeroCarousel";
import HeroFeature from "./HeroFeature";
import Image from "next/image";

const Hero = () => {
  return (
    <section className="overflow-hidden pb-10 lg:pb-12.5 xl:pb-15 pt-57.5 sm:pt-45 lg:pt-30 xl:pt-51.5 bg-[#F7EDE7]">
      <div className="max-w-[1170px] w-full mx-auto px-4 sm:px-8 xl:px-0">
        <div className="flex flex-wrap gap-5">
          <div className="xl:max-w-[757px] w-full">
            <div className="relative z-1 rounded-[10px] bg-white overflow-hidden">
              {/* <!-- bg shapes --> */}
              <Image
                src="/images/hero/hero-bg.png"
                alt="hero bg shapes"
                className="absolute right-0 bottom-0 -z-1"
                width={534}
                height={520}
              />

              <HeroCarousel />
            </div>
          </div>

          <div className="xl:max-w-[393px] w-full">
            <div className="flex flex-col sm:flex-row xl:flex-col gap-5">
              <div className="w-full relative rounded-[10px] bg-white p-4 sm:p-7.5">
                <div className="min-h-[220px] flex flex-col justify-between">
                  <div>
                    <span className="inline-flex rounded-full bg-blue/10 px-3 py-1 text-sm font-medium text-blue mb-5">
                      New This Week
                    </span>
                    <h2 className="max-w-[240px] font-semibold text-dark text-2xl mb-4">
                      Fresh women&apos;s arrivals with wearable color and soft detail.
                    </h2>
                  </div>

                  <div>
                    <p className="font-medium text-dark-4 text-custom-sm mb-1.5">
                      in store now
                    </p>
                    <span className="block font-medium text-heading-6 text-dark">
                      Updated retail picks curated for everyday dressing in Oman.
                    </span>
                  </div>
                </div>
              </div>
              <div className="w-full relative rounded-[10px] bg-dark p-4 sm:p-7.5">
                <div className="min-h-[220px] flex flex-col justify-between">
                  <div>
                    <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white mb-5">
                      Kidswear Edit
                    </span>
                    <h2 className="max-w-[240px] font-semibold text-white text-2xl mb-4">
                      Comfortable sets and standout pieces for girls and little trendsetters.
                    </h2>
                  </div>

                  <div>
                    <p className="font-medium text-white/70 text-custom-sm mb-1.5">
                      retail favorites
                    </p>
                    <span className="block font-medium text-lg text-white">
                      A playful mix of seasonal styles for family shopping.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* <!-- Hero features --> */}
      <HeroFeature />
    </section>
  );
};

export default Hero;
