import { Outlet } from "react-router-dom";
import Navbar from "./components/navbar/Navbar";
import Footer from "./components/footer/Footer";
import BackToTop from "./components/backToTop/BackToTop";
import ScrollToTop from "./components/router/ScrollToTop";

const Layout = () => {

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
