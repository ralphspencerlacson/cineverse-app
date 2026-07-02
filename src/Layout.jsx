import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./components/navbar/Navbar";
import Footer from "./components/footer/Footer";
import BackToTop from "./components/backToTop/BackToTop";
import Newsletter from "./components/newsletter/Newsletter";
import ScrollToTop from "./components/router/ScrollToTop";

const Layout = () => {
  const location = useLocation();

  return (
    <>
      <BackToTop />
      <ScrollToTop />

      <Navbar />
      <Outlet />


      <Footer />
    </>
  );
};

export default Layout;
