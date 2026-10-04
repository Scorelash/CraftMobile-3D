import * as THREE from 'three';
import { sound } from './audio';

export interface BossFireball {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
}

export class BossMonster {
  public group: THREE.Group;
  public pos: THREE.Vector3;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public targetPos: THREE.Vector3;
  public health: number = 100;
  public maxHealth: number = 100;
  public isAlive: boolean = true;

  // Animation & AI state
  private wingTimer: number = 0;
  private leftWing: THREE.Group;
  private rightWing: THREE.Group;
  private head: THREE.Group;
  private body: THREE.Mesh;
  private tail: THREE.Group;
  private shootTimer: number = 0;
  private swoopTimer: number = 0;
  private isSwooping: boolean = false;
  private hurtFlashTimer: number = 0;
  private bodyMat: THREE.MeshLambertMaterial;

  constructor(x: number, y: number, z: number) {
    this.pos = new THREE.Vector3(x, y, z);
    this.targetPos = new THREE.Vector3(x, y + 4, z);
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);

    // =========================================================================
    // 3D Dragon Mesh Construction
    // =========================================================================
    this.bodyMat = new THREE.MeshLambertMaterial({ color: 0x18141f }); // obsidian black
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff00cc }); // glowing magenta eyes
    const hornMat = new THREE.MeshLambertMaterial({ color: 0x888888 }); // gray horns
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x241d2e, side: THREE.DoubleSide });
    const spineMat = new THREE.MeshLambertMaterial({ color: 0x4d004d });

    // 1. Torso / Main Body
    const bodyGeom = new THREE.BoxGeometry(1.6, 1.3, 3.4);
    this.body = new THREE.Mesh(bodyGeom, this.bodyMat);
    this.group.add(this.body);

    // Purple spine ridges along back
    for (let i = -1.2; i <= 1.2; i += 0.6) {
      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 4), spineMat);
      spine.position.set(0, 0.85, i);
      this.group.add(spine);
    }

    // 2. Neck & Head
    this.head = new THREE.Group();
    this.head.position.set(0, 0.6, 2.0);

    // Neck
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.2), this.bodyMat);
    neck.position.set(0, 0.2, 0.4);
    this.head.add(neck);

    // Skull
    const skull = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.4), this.bodyMat);
    skull.position.set(0, 0.35, 1.3);
    this.head.add(skull);

    // Snout / Jaws
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 1.2), this.bodyMat);
    snout.position.set(0, 0.15, 2.2);
    this.head.add(snout);

    // Glowing Magenta Eyes
    const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.25), eyeMat);
    leftEye.position.set(-0.55, 0.45, 1.5);
    this.head.add(leftEye);

    const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.25), eyeMat);
    rightEye.position.set(0.55, 0.45, 1.5);
    this.head.add(rightEye);

    // Dragon Horns
    const leftHorn = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 4), hornMat);
    leftHorn.position.set(-0.4, 0.9, 1.0);
    leftHorn.rotation.x = -0.5;
    leftHorn.rotation.z = -0.2;
    this.head.add(leftHorn);

    const rightHorn = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 4), hornMat);
    rightHorn.position.set(0.4, 0.9, 1.0);
    rightHorn.rotation.x = -0.5;
    rightHorn.rotation.z = 0.2;
    this.head.add(rightHorn);

    this.group.add(this.head);

    // 3. Wings (Flapping Left & Right)
    this.leftWing = new THREE.Group();
    this.leftWing.position.set(-0.8, 0.4, 0.3);
    const lWingMain = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 1.8), wingMat);
    lWingMain.position.set(-1.8, 0, 0);
    this.leftWing.add(lWingMain);
    this.group.add(this.leftWing);

    this.rightWing = new THREE.Group();
    this.rightWing.position.set(0.8, 0.4, 0.3);
    const rWingMain = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 1.8), wingMat);
    rWingMain.position.set(1.8, 0, 0);
    this.rightWing.add(rWingMain);
    this.group.add(this.rightWing);

    // 4. Tail
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0, -1.7);
    for (let t = 0; t < 3; t++) {
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(0.8 - t * 0.2, 0.8 - t * 0.2, 1.2),
        this.bodyMat
      );
      seg.position.set(0, 0, -0.6 - t * 1.1);
      this.tail.add(seg);
    }
    this.group.add(this.tail);
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    onSpawnFireball: (fireball: BossFireball) => void
  ) {
    if (!this.isAlive) return;

    // Wing flapping animation
    this.wingTimer += dt * 5.5;
    const wingAngle = Math.sin(this.wingTimer) * 0.65;
    this.leftWing.rotation.z = -wingAngle;
    this.rightWing.rotation.z = wingAngle;

    // Tail gentle sway
    this.tail.rotation.y = Math.sin(this.wingTimer * 0.6) * 0.25;

    // Hurt flash
    if (this.hurtFlashTimer > 0) {
      this.hurtFlashTimer -= dt;
      if (this.hurtFlashTimer <= 0) {
        this.bodyMat.color.set(0x18141f);
      }
    }

    // AI movement logic:
    // Alternate between circling overhead and swooping towards the player!
    this.swoopTimer += dt;

    if (this.swoopTimer > 10) {
      this.swoopTimer = 0;
      this.isSwooping = !this.isSwooping;
    }

    if (this.isSwooping) {
      // Swoop directly towards player position
      this.targetPos.set(playerPos.x, playerPos.y + 1.5, playerPos.z);
    } else {
      // Circle smoothly overhead
      const circleAngle = performance.now() * 0.0006;
      const radius = 18;
      this.targetPos.set(
        playerPos.x + Math.cos(circleAngle) * radius,
        playerPos.y + 9 + Math.sin(circleAngle * 2) * 3,
        playerPos.z + Math.sin(circleAngle) * radius
      );
    }

    // Move smoothly towards target position
    const toTarget = new THREE.Vector3().subVectors(this.targetPos, this.pos);
    const dist = toTarget.length();

    if (dist > 0.5) {
      toTarget.normalize();
      const speed = this.isSwooping ? 12 : 8;
      this.velocity.lerp(toTarget.multiplyScalar(speed), dt * 3);
      this.pos.addScaledVector(this.velocity, dt);
      this.group.position.copy(this.pos);

      // Face direction of travel
      if (this.velocity.lengthSq() > 0.1) {
        const lookTarget = this.pos.clone().add(this.velocity);
        this.group.lookAt(lookTarget);
      }
    }

    // Shoot purple fireball periodically
    this.shootTimer += dt;
    if (this.shootTimer >= 3.8) {
      this.shootTimer = 0;
      this.launchFireball(playerPos, onSpawnFireball);
    }
  }

  private launchFireball(
    playerPos: THREE.Vector3,
    onSpawnFireball: (fireball: BossFireball) => void
  ) {
    const startPos = this.pos.clone().add(new THREE.Vector3(0, 0.5, 1.5));
    const dir = new THREE.Vector3().subVectors(playerPos, startPos).normalize();

    // Cosmic Fireball mesh
    const geom = new THREE.SphereGeometry(0.35, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xb500d4 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(startPos);

    sound.playHurt();

    onSpawnFireball({
      mesh,
      pos: startPos,
      velocity: dir.multiplyScalar(15), // fast projectile
      life: 5.0,
    });
  }

  public takeDamage(damage: number, knockbackDir?: THREE.Vector3): boolean {
    if (!this.isAlive) return false;

    this.health = Math.max(0, this.health - damage);
    this.hurtFlashTimer = 0.25;
    this.bodyMat.color.set(0xff2222); // red flash
    sound.playHurt();

    // Apply knockback
    if (knockbackDir) {
      this.pos.addScaledVector(knockbackDir, 1.8);
      this.pos.y += 0.8;
      this.group.position.copy(this.pos);
    }

    if (this.health <= 0) {
      this.isAlive = false;
      return true; // boss defeated!
    }

    return false;
  }
}
