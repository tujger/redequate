import ClearIcon from "@material-ui/icons/Clear";
import React from "react";
import {useTranslation} from "react-i18next";
import DocumentThumbnailComponent from "../DocumentThumbnailComponent";
import {uploadComponentClean} from "../UploadComponent/uploadComponentControls";
import imageStyles from "./styles/Images.module.css";

export default ({disabled, images, onChange, uppy}) => {
    const {t} = useTranslation();

    const handleSavedImageRemove = index => () => {
        const newImages = images.filter((image, i) => i !== index);
        onChange({images: newImages, uppy});
    }

    const handleImageRemove = key => () => {
        uploadComponentClean(uppy, key);
        onChange({images, uppy});
    }

    const handleRemoveKeyDown = handler => event => {
        if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        handler();
    };

    const removeButton = handler => <div
        aria-disabled={disabled}
        className={imageStyles.removeButton}
        onClick={disabled ? undefined : handler}
        onKeyDown={handleRemoveKeyDown(handler)}
        role='button'
        tabIndex={disabled ? -1 : 0}
        title={t("Post.Remove image")}
    >
        <ClearIcon/>
    </div>;

    return <div className={imageStyles.previewGrid}>
        {images && images.map((image, index) => {
            return <div className={imageStyles.imageItem} key={index}>
                <DocumentThumbnailComponent
                    className={imageStyles.preview}
                    url={image}/>
                {removeButton(handleSavedImageRemove(index))}
            </div>
        })}
        {uppy && Object.keys(uppy._uris).map((key) => {
            const file = uppy._uris[key];
            return <div className={imageStyles.imageItem} key={key}>
                <DocumentThumbnailComponent
                    alt={file.name}
                    className={imageStyles.preview}
                    title={file.name}
                    url={file.uploadURL}/>
                {removeButton(handleImageRemove(key))}
            </div>
        })}
    </div>
}
