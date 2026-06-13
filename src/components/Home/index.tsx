import React from "react";
import Hero from "./Hero";
import Categories from "./Categories";
import PromoBanner from "./PromoBanner";
import CounDown from "./Countdown";

const Home = () => {
  return (
    <main>
      <Hero />
      <Categories />
      <PromoBanner />
      <CounDown />
    </main>
  );
};

export default Home;
