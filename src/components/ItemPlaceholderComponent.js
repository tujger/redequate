import { Card, CardHeader, Grid, Skeleton } from '@mui/material'
import React from 'react'
import AvatarView from './AvatarView'
import styles from './styles/ItemPlaceholderComponent.module.css'

const ItemPlaceholderComponent = ({
    avatar,
    className,
    label,
    onClick,
    pattern
}) => (
    <Card
        className={[
            styles.card,
            pattern ? styles[`card${pattern.substr(0, 1).toUpperCase()}${pattern.substr(1)}`] : '',
            className,
        ].join(' ')}
        onClick={onClick}
    >
        <CardHeader
            avatar={avatar !== null && (avatar || (label
                ? <AvatarView
                    className={styles.avatar}
                    image={avatar}
                    initials={label}
                    verified={true}
                />
                : <Skeleton
                    animation={label ? false : 'wave'}
                    className={styles.avatar}
                    variant={'circle'}
                />))}
            className={[styles.cardHeader, '', label ? styles.cardHeaderWithLabel : ''].join(' ')}
            disableTypography
            subheader={!label && <>
                <Skeleton
                    animation={'wave'}
                    height={12}
                    style={{ marginBottom: 6 }}
                    width={'100%'}
                />
                <Grid
                    className={styles.cardActions}>
                    <Skeleton
                        animation={false}
                        height={10}
                        style={{ marginBottom: 6 }}
                        variant={'rect'}
                        width={'100%'}
                    />
                </Grid>
            </>}
            title={label || <Skeleton
                animation={'wave'}
                height={12}
                style={{ marginBottom: 6 }}
                width={'40%'}
            />}
        />
    </Card>
)

export default ItemPlaceholderComponent
