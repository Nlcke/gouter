import {ImageSourcePropType} from 'react-native';

declare global {
  declare module '*.png' {
    const content: ImageSourcePropType;
    export default content;
  }

  declare module '*.jpg' {
    const content: ImageSourcePropType;
    export default content;
  }

  declare module '*.jpeg' {
    const content: ImageSourcePropType;
    export default content;
  }
}
