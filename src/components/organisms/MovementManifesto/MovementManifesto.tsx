import { FunctionComponent } from 'react';
import { Icon, Label, Text } from '../../atoms';
import styles from './MovementManifesto.module.css';

const MovementManifesto: FunctionComponent = () => {
  return (
    <div className={styles.movementManifesto}>
      <Text as="b">NO ES SOLO DEPORTE. ES TU FORMA DE MOVERTE.</Text>
      <div className={styles.sportIndex}>
        <Label>RUNNING / TRAINING / FÚTBOL / MÁS</Label>
        <Icon size={24} />
      </div>
    </div>
  );
};

export default MovementManifesto;
