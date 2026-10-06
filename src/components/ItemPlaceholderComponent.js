import React from "react";
import AvatarView from "./AvatarView";
import classes from "./styles/ItemPlaceholderComponent.module.css";

const ItemPlaceholderComponent = ({avatar, classes: givenClasses, className, label, onClick, pattern}) => {
    const patternName = pattern && `card${pattern.substr(0, 1).toUpperCase()}${pattern.substr(1)}`;
    const avatarContent = avatar !== null && (React.isValidElement(avatar)
        ? React.cloneElement(avatar, {
            className: [classes.avatarSmallest, givenClasses?.avatarSmallest, avatar.props.className]
                .filter(Boolean)
                .join(" "),
        })
        : avatar || label
            ? <AvatarView
                className={[classes.avatar, givenClasses?.avatar].filter(Boolean).join(" ")}
                image={avatar}
                initials={label}
                verified={true}
            />
            : <span
                className={[classes.skeleton, classes.skeletonCircle, classes.avatar, givenClasses?.skeleton, givenClasses?.skeletonCircle, givenClasses?.avatar]
                    .filter(Boolean)
                    .join(" ")}
            />);

    return <div
        className={[classes.card, givenClasses?.card, pattern && classes[patternName], pattern && givenClasses?.[patternName], className]
            .filter(Boolean)
            .join(" ")}
        onClick={onClick}
    >
        <div
            className={[classes.cardHeader, givenClasses?.cardHeader, label && classes.cardHeaderWithLabel, label && givenClasses?.cardHeaderWithLabel]
                .filter(Boolean)
                .join(" ")}
        >
            {avatarContent && <div
                className={[classes.avatarWrapper, givenClasses?.avatarWrapper].filter(Boolean).join(" ")}>{avatarContent}</div>}
            <div className={[classes.headerContent, givenClasses?.headerContent].filter(Boolean).join(" ")}>
                {label || <>
                    <span
                        className={[classes.skeleton, classes.skeletonLine, givenClasses?.skeleton, givenClasses?.skeletonLine]
                            .filter(Boolean)
                            .join(" ")}
                        style={{
                            "--skeleton-height": "12px",
                            "--skeleton-margin-bottom": "6px",
                            "--skeleton-width": "40%"
                        }}
                    />
                    <span
                        className={[classes.skeleton, classes.skeletonLine, givenClasses?.skeleton, givenClasses?.skeletonLine]
                            .filter(Boolean)
                            .join(" ")}
                        style={{
                            "--skeleton-height": "12px",
                            "--skeleton-margin-bottom": "6px",
                            "--skeleton-width": "100%"
                        }}
                    />
                    <div className={[classes.cardActions, givenClasses?.cardActions].filter(Boolean).join(" ")}>
                        <span
                            className={[classes.skeleton, classes.skeletonRect, classes.skeletonStatic, givenClasses?.skeleton, givenClasses?.skeletonRect, givenClasses?.skeletonStatic]
                                .filter(Boolean)
                                .join(" ")}
                            style={{
                                "--skeleton-height": "10px",
                                "--skeleton-margin-bottom": "6px",
                                "--skeleton-width": "100%"
                            }}
                        />
                    </div>
                </>}
            </div>
        </div>
    </div>;
};

export default ItemPlaceholderComponent;
