import { LinearProgress } from '@mui/material'
import React from 'react'
import { connect } from 'react-redux'
import styles from './styles/ProgressView.module.css'

export const ProgressView = ({
    show,
    value = null,
    className
}) => {
    return <LinearProgress
        color={'secondary'}
        variant={value === null ? 'indeterminate' : 'determinate'}
        value={value}
        className={[styles.progress, show ? '' : styles.invisibleProgress, className].join(' ')}/>
}

ProgressView.SHOW = { type: 'progressView_Show' }
ProgressView.HIDE = { type: 'progressView_Hide' }

export const progressViewReducer = (state = {
    show: false,
    value: null
}, action) => {
    switch (action.type) {
        case ProgressView.SHOW.type:
            if (action.value) {
                return {
                    show: true,
                    value: +action.value
                }
            } else {
                return {
                    show: true,
                    value: null
                }
            }
        case ProgressView.HIDE.type:
            return {
                show: false,
                value: null
            }
        default:
            return state
    }
}

const mapStateToProps = ({ progressView }) => ({
    show: progressView.show,
    value: progressView.value
})

export default connect(mapStateToProps)(ProgressView)
