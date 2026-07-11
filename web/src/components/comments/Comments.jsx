import React from "react";
import "./Comments.css";

const Comments = ({ tmbdID }) => {
  return (
    <section className="comments">
      {tmbdID}

      <div className="comment">
        <p className="name">John Supreme Doe</p>
        <p className="date">August 11, 2021</p>
        <p className="message">
          Pellentesque dictum eleifend efficitur. Integer eget sollicitudin
          eros. Vestibulum elit nisi, tincidunt eget ipsum a, ultricies pulvinar
          lorem.
        </p>
      </div>

      <div className="comment">
        <p className="name">John Supreme Doe</p>
        <p className="date">August 11, 2021</p>
        <p className="message">
          Nulla quis augue nisi. Nullam magna turpis, luctus ut ex ut, egestas
          commodo mi. Maecenas viverra, enim sodales volutpat consequat, lectus
          nulla eleifend mauris, quis fermentum elit ligula eget dolor. Proin
          viverra arcu nec velit ultricies, sed commodo magna semper. Aliquam eu
          rutrum risus. Nam bibendum id purus vel vehicula. Phasellus
          condimentum vel nibh at pharetra.
        </p>
      </div>

      <div className="comment">
        <p className="name">John Supreme Doe</p>
        <p className="date">August 11, 2021</p>
        <p className="message">Lorem ipsum dolor sit amet.</p>
      </div>
    </section>
  );
};

export default Comments;
