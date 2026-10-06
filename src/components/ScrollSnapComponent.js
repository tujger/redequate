import React from "react";
import styles from "./styles/ScrollSnapComponent.module.css";

/**
 Implementation in context of
 https://ishadeed.com/article/css-scroll-snap/
 **/

export default (
    {
        align = "center",
        className,
        items,
        style = {},
        variant = "horizontal",
        fullHeight = true
    }) => {
    const variantClass = variant === "horizontal" ? styles.horizontal : styles.vertical;

    return <div
        className={[styles.list, variantClass, variant === "vertical" && fullHeight && styles.fullHeight, className]
            .filter(Boolean)
            .join(" ")}
        style={style}
    >
        {items.map((item, index) => React.cloneElement(item, {
            className: [styles.item, item.props.className].filter(Boolean).join(" "),
            key: index,
            style: {
                "--scroll-snap-align": align,
                ...(item.props.style || {}),
            },
        }))}
    </div>
}
