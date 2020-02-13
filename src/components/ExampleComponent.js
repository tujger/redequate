import React, {Component} from 'react'
import PropTypes from 'prop-types'

export class ExampleComponent extends Component {
  static propTypes = {
    text: PropTypes.string
  }

  render() {
    const {
      text
    } = this.props

    return (
      <div>
        Example Component for: {text}
      </div>
    )
  }
}

