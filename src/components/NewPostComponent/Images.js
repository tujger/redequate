import React from "react";
import Grid from "@material-ui/core/Grid";
import IconButton from "@material-ui/core/IconButton";
import ClearIcon from "@material-ui/icons/Clear";
import Box from "@material-ui/core/Box";
import {useTranslation} from "react-i18next";
import {uploadComponentClean} from "../UploadComponent/uploadComponentControls";
import DocumentThumbnailComponent from "../DocumentThumbnailComponent";

export default ({classes, disabled, images, onChange, uppy}) => {
    const {t} = useTranslation();

    const handleSavedImageRemove = index => () => {
        const newImages = images.filter((image, i) => i !== index);
        onChange({images: newImages, uppy});
    }

    const handleImageRemove = key => () => {
        uploadComponentClean(uppy, key);
        onChange({images, uppy});
    }

    return <>
        <Box m={1}/>
        <Grid container justify={"center"}>
            {images && images.map((image, index) => {
                return <Grid item key={index}>
                    <DocumentThumbnailComponent
                        className={classes._preview}
                        url={image}/>
                    <IconButton
                        children={<ClearIcon/>}
                        color={"secondary"}
                        disabled={disabled}
                        onClick={handleSavedImageRemove(index)}
                        size={"small"}
                        title={t("Post.Remove image")}
                    />
                </Grid>
            })}
            {uppy && Object.keys(uppy._uris).map((key) => {
                const file = uppy._uris[key];
                return <Grid item key={key}>
                    <DocumentThumbnailComponent
                        alt={file.name}
                        className={classes._preview}
                        title={file.name}
                        url={file.uploadURL}/>
                    <IconButton
                        children={<ClearIcon/>}
                        color={"secondary"}
                        disabled={disabled}
                        onClick={handleImageRemove(key)}
                        size={"small"}
                        title={t("Post.Remove image")}
                    />
                </Grid>
            })}
        </Grid>
    </>
}
