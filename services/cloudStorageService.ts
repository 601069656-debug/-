import { doc, setDoc, getDoc, getDocs, collection, query, orderBy, serverTimestamp, writeBatch, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { GameState, Message, NPCProfile, LogSummary, GameStatus, Character, GaiaState } from '../types';

export async function saveGameStateToCloud(userId: string, gameState: GameState) {
  if (!userId) return;

  try {
    const gameDocRef = doc(db, 'games', userId);
    
    // 1. Save main state (without heavy collections)
    const rootState = {
      status: gameState.status,
      character: gameState.character || null,
      difficulty: gameState.difficulty,
      stageSettings: gameState.stageSettings || null,
      selectedStages: gameState.selectedStages || [],
      
      gaiaState: gameState.gaiaState || null,
      
      lastUpdated: serverTimestamp(),
    };

    await setDoc(gameDocRef, rootState, { merge: true });

    // 2. Save NPCs (only if they exist)
    if (gameState.npcProfiles && gameState.npcProfiles.length > 0) {
      const npcBatch = writeBatch(db);
      gameState.npcProfiles.forEach(npc => {
        const npcRef = doc(db, `games/${userId}/npcs`, npc.id);
        npcBatch.set(npcRef, {
          ...npc,
          lastUpdated: serverTimestamp()
        });
      });
      await npcBatch.commit();
    }

    // 3. Save Logs (only if they exist)
    if (gameState.logs && gameState.logs.length > 0) {
      const logBatch = writeBatch(db);
      gameState.logs.forEach(log => {
        const logRef = doc(db, `games/${userId}/logs`, log.id);
        logBatch.set(logRef, log);
      });
      await logBatch.commit();
    }

    // 4. Save History (optional, maybe only latest messages or if requested)
    // For now, let's just save the last 50 messages to keep it manageable
    const historyToSave = gameState.history.slice(-50);
    if (historyToSave.length > 0) {
      const historyBatch = writeBatch(db);
      historyToSave.forEach(msg => {
         // Sanitizing message for Firestore
         const { snapshot, groundingMetadata, isStreaming, ...cleanMsg } = msg as any;
         const msgRef = doc(db, `games/${userId}/history`, msg.id);
         historyBatch.set(msgRef, cleanMsg);
      });
      await historyBatch.commit();
    }

  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `games/${userId}`);
    throw error;
  }
}

export async function loadGameStateFromCloud(userId: string): Promise<Partial<GameState> | null> {
  if (!userId) return null;

  try {
    const gameDocRef = doc(db, 'games', userId);
    const docSnap = await getDoc(gameDocRef);

    if (!docSnap.exists()) return null;

    const rootData = docSnap.data();

    // Fetch subcollections
    const npcsSnap = await getDocs(collection(db, `games/${userId}/npcs`));
    const npcProfiles = npcsSnap.docs.map(d => d.data() as NPCProfile);

    const logsSnap = await getDocs(query(collection(db, `games/${userId}/logs`), orderBy('timestamp', 'asc')));
    const logs = logsSnap.docs.map(d => d.data() as LogSummary);

    const historySnap = await getDocs(query(collection(db, `games/${userId}/history`), orderBy('id', 'asc'))); // Assuming sequential IDs or we should sort by timestamp if available
    const history = historySnap.docs.map(d => d.data() as Message);

    return {
      ...rootData,
      npcProfiles,
      logs,
      history,
    } as Partial<GameState>;

  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `games/${userId}`);
    return null;
  }
}
