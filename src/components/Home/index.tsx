import React from "react";
import Hero from "./Hero";
import Categories from "./Categories";
import NewArrival from "./NewArrivals";
import PromoBanner from "./PromoBanner";
import BestSeller from "./BestSeller";
import CounDown from "./Countdown";
import Testimonials from "./Testimonials";
import Newsletter from "@/components/Common/Newsletter";

const Home = () => {
  return (
    <main>
      <Hero />
      {/* Each section rises into view on scroll (see Common/Reveal). */}
      <div data-reveal><Categories /></div>
      <div data-reveal><NewArrival /></div>
      <div data-reveal><PromoBanner /></div>
      <div data-reveal><BestSeller /></div>
      <div data-reveal><CounDown /></div>
      <div data-reveal><Testimonials /></div>
      <div data-reveal className="pb-12 sm:pb-16">
        <Newsletter />
      </div>
    </main>
  );
};

export default Home;
