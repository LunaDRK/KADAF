import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
} from "react-native";
import { supabase } from "../services/supabase";

//Definición de tipos para la estructura de props y analisis
type Props = {
  candidatoId: string;
  vacanteId: string;
  cvPath: string;
  volver: () => void;
};

type Analisis = {
  compatibility_score: number;
  strengths: string[];
  areas_to_evaluate: string[];
  summary: string;
};

// Componenete de la pantalla
export default function PerfilCandidatoScreen({
  candidatoId,
  vacanteId,
  cvPath,
  volver,
}: Props) {

  //Estados para indicar si esta cargando o para guardar
  const [candidato, setCandidato] = useState<any>(null);
  const [vacante, setVacante] = useState<any>(null);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [cargando, setCargando] = useState(true);
  const [analizando, setAnalizando] = useState(false);
  const [errorAnalisis, setErrorAnalisis] = useState("");

  //Cargamos el candidato con la vacante que solicito
  useEffect(() => {
    cargarDatos();
  }, [candidatoId, vacanteId]);

  const cargarDatos = async () => {
    setCargando(true);
    setAnalisis(null);

    // Realizamos las consultas a la base de datos para obtener los datos del candidato y la vacante
    const [respuestaCandidato, respuestaVacante] = await Promise.all([
      supabase
        .from("candidatos")
        .select(
          "id, nombre_completo, email, telefono, educacion, experiencia, habilidades",
        )
        .eq("id", candidatoId)
        .single(),

      supabase
        .from("vacantes")
        .select(
          "id, titulo, empresa, salario, ubicacion, descripcion, requisitos, activa",
        )
        .eq("id", vacanteId)
        .single(),
    ]);

    if (respuestaCandidato.error || respuestaVacante.error) {
      Alert.alert(
        "Error",
        respuestaCandidato.error?.message ||
          respuestaVacante.error?.message ||
          "No se pudieron cargar los datos.",
      );
    } else {
      setCandidato(respuestaCandidato.data);
      setVacante(respuestaVacante.data);
    }

    setCargando(false);
  };

  //Funcion para acceder y abrir el cv
  const verCV = async () => {
    const { data, error } = await supabase.storage
      .from("cv-postulaciones")
      .createSignedUrl(cvPath, 60);

    if (error || !data?.signedUrl) {
      Alert.alert("Error", "No se pudo obtener el PDF.");
      return;
    }

    try {
      await Linking.openURL(data.signedUrl);
    } catch {
      Alert.alert("Error", "No se pudo abrir el CV.");
    }
  };

  //Funcion para analizar la compatibilidad del candidato con la vacante
  const analizarCompatibilidad = async () => {
    if (!candidato || !vacante) return;

    const tieneInformacion =
      !!candidato.educacion?.trim() ||
      !!candidato.experiencia?.trim() ||
      (Array.isArray(candidato.habilidades) &&
        candidato.habilidades.length > 0);

    const tieneRequisitos =
      !!vacante.descripcion?.trim() ||
      (Array.isArray(vacante.requisitos) && vacante.requisitos.length > 0);

    if (!tieneInformacion || !tieneRequisitos) {
      Alert.alert(
        "Información incompleta",
        "Se necesita información profesional del candidato y una descripción o requisitos de la vacante.",
      );
      return;
    }

    setAnalizando(true);
    setAnalisis(null);
    setErrorAnalisis("");

    console.log("Iniciando análisis de compatibilidad");

    try {
      // Invocamos la función de Supabase para analizar al candidato con la vacante
      const { data, error } = await supabase.functions.invoke(
        "analizar-candidato",
        {
          body: {
            candidato: {
              educacion: candidato.educacion,
              experiencia: candidato.experiencia,
              habilidades: candidato.habilidades,
            },
            vacante: {
              titulo: vacante.titulo,
              empresa: vacante.empresa,
              descripcion: vacante.descripcion,
              requisitos: vacante.requisitos,
            },
          },
        },
      );
      console.log("Respuesta de la IA:", data);
      console.log("Error de la IA:", error);

      if (error) {
        const respuesta = (error as any).context;

        if (respuesta?.status) {
          const detalle = await respuesta.text();

          console.log("Código HTTP:", respuesta.status);
          console.log("Detalle del error:", detalle);

          throw new Error(`Error ${respuesta.status}: ${detalle}`);
        }

        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const resultado = data as Analisis;

      if (
        !resultado ||
        !Number.isInteger(resultado.compatibility_score) ||
        resultado.compatibility_score < 0 ||
        resultado.compatibility_score > 100 ||
        !Array.isArray(resultado.strengths) ||
        !Array.isArray(resultado.areas_to_evaluate) ||
        typeof resultado.summary !== "string"
      ) {
        throw new Error("La IA devolvió un resultado incorrecto.");
      }

      // Guardamos el resultado en la tabla "analisis_ia"
      const { error: errorGuardar } = await supabase
        .from("analisis_ia")
        .insert({
          candidato_id: candidatoId,
          vacante_id: vacanteId,
          puntuacion_compatibilidad: resultado.compatibility_score,
          fortalezas: resultado.strengths,
          areas_por_evaluar: resultado.areas_to_evaluate,
          resumen: resultado.summary,
        });

      if (errorGuardar) {
        throw new Error(
          "Se generó el análisis, pero no se pudo guardar: " +
            errorGuardar.message,
        );
      }

      //Si se guarda correctamente, actualizamos el estado para mostrar el resultado
      setAnalisis(resultado);
      Alert.alert("Listo", "Análisis generado y guardado.");

    } catch (error: any) {
      console.error("Error completo del análisis:", error);
      setErrorAnalisis(error?.message || "No se pudo realizar el análisis.");
    } finally {
      setAnalizando(false);
    }
  };

  // Funcion para renderizar la pantalla de perfil del candidato
  if (cargando) {
    return (
      <View style={styles.cargando}>
        <ActivityIndicator size="large" color="#087E8B" />
        <Text>Cargando perfil...</Text>
      </View>
    );
  }

  // Si no se encuentran los datos del candidato o la vacante, mostramos un mensaje de error
  if (!candidato || !vacante) {
    return (
      <View style={styles.cargando}>
        <Text>No se encontraron los datos del perfil.</Text>
        <TouchableOpacity style={styles.boton} onPress={volver}>
          <Text style={styles.textoBoton}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Renderizamos la información del candidato, la vacante y el análisis de compatibilidad
  return (
    <ScrollView
      style={styles.pantalla}
      contentContainerStyle={styles.contenidoPantalla}
    >
      <View style={styles.encabezado}>
        <TouchableOpacity onPress={volver}>
          <Text style={styles.volver}>← Volver a postulaciones</Text>
        </TouchableOpacity>

        <Text style={styles.marca}>KADAF</Text>
        <Text style={styles.titulo}>Perfil de candidato</Text>
        <Text style={styles.subtitulo}>
          Información y análisis de compatibilidad
        </Text>
      </View>

      <View style={styles.tarjeta}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTexto}>
            {candidato.nombre_completo?.charAt(0).toUpperCase() || "C"}
          </Text>
        </View>

        <Text style={styles.nombre}>
          {candidato.nombre_completo || "Candidato"}
        </Text>
        <Text style={styles.dato}>{candidato.email}</Text>
        {!!candidato.telefono && (
          <Text style={styles.dato}>{candidato.telefono}</Text>
        )}

        <TouchableOpacity style={styles.botonCV} onPress={verCV}>
          <Text style={styles.textoBoton}>Ver currículum PDF</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.seccion}>
        <Text style={styles.tituloSeccion}>Vacante para el análisis</Text>
        <Text style={styles.nombreVacante}>{vacante.titulo}</Text>
        <Text style={styles.dato}>{vacante.empresa}</Text>
        <Text style={styles.dato}>{vacante.ubicacion}</Text>

        {!!vacante.descripcion && (
          <Text style={styles.contenido}>{vacante.descripcion}</Text>
        )}

        <Text style={styles.subtituloSeccion}>Requisitos</Text>
        {Array.isArray(vacante.requisitos) && vacante.requisitos.length > 0 ? (
          vacante.requisitos.map((requisito: string, i: number) => (
            <Text key={i} style={styles.contenido}>
              • {requisito}
            </Text>
          ))
        ) : (
          <Text style={styles.contenido}>No hay requisitos registrados.</Text>
        )}
      </View>

      <View style={styles.seccion}>
        <Text style={styles.tituloSeccion}>Formación académica</Text>
        <Text style={styles.contenido}>
          {candidato.educacion || "Sin información registrada."}
        </Text>
      </View>

      <View style={styles.seccion}>
        <Text style={styles.tituloSeccion}>Experiencia profesional</Text>
        <Text style={styles.contenido}>
          {candidato.experiencia || "Sin información registrada."}
        </Text>
      </View>

      <View style={styles.seccion}>
        <Text style={styles.tituloSeccion}>Habilidades</Text>
        {Array.isArray(candidato.habilidades) &&
        candidato.habilidades.length > 0 ? (
          candidato.habilidades.map((habilidad: string, i: number) => (
            <Text key={i} style={styles.contenido}>
              • {habilidad}
            </Text>
          ))
        ) : (
          <Text style={styles.contenido}>Sin habilidades registradas.</Text>
        )}
      </View>

      <View style={styles.seccion}>
        <Text style={styles.tituloSeccion}>Análisis de compatibilidad</Text>

        <Text style={styles.contenido}>
          Compara el perfil profesional con los requisitos de la vacante.
        </Text>

        <TouchableOpacity
          style={[styles.boton, analizando && styles.deshabilitado]}
          onPress={analizarCompatibilidad}
          disabled={analizando}
        >
          {analizando ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.textoBoton}>Analizar compatibilidad</Text>
          )}
        </TouchableOpacity>
        {analizando && (
          <Text style={{ color: "#667085", marginTop: 10 }}>
            {" "}
            Consultando la inteligencia artificial...{" "}
          </Text>
        )}

        {!!errorAnalisis && (
          <Text style={{ color: "#DC2626", marginTop: 12 }}>
            {" "}
            Error: {errorAnalisis}{" "}
          </Text>
        )}

        
        {analisis && (
          <View style={styles.resultado}>
            <Text style={styles.tituloSeccion}>Compatibilidad</Text>

            <Text style={styles.puntuacion}>
              {analisis.compatibility_score}%
            </Text>

            <View style={styles.barraFondo}>
              <View
                style={[
                  styles.barraProgreso,
                  { width: `${analisis.compatibility_score}%` },
                ]}
              />
            </View>

            <Text style={styles.contenido}>{analisis.summary}</Text>

            <Text style={styles.subtituloSeccion}>Fortalezas</Text>
            {analisis.strengths.map((fortaleza, i) => (
              <Text key={i} style={styles.contenido}>
                • {fortaleza}
              </Text>
            ))}

            <Text style={styles.subtituloSeccion}>Áreas por evaluar</Text>
            {analisis.areas_to_evaluate.map((area, i) => (
              <Text key={i} style={styles.contenido}>
                • {area}
              </Text>
            ))}

            <Text style={styles.aviso}>
              Este resultado es orientativo. El reclutador debe evaluar
              personalmente al candidato antes de tomar decisiones.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#F3F6FA" },
  contenidoPantalla: { paddingBottom: 28 },
  cargando: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  encabezado: {
    backgroundColor: "#17365D",
    padding: 24,
    paddingTop: 30,
  },
  volver: { color: "#FFFFFF", marginBottom: 16 },
  marca: { color: "#4DD0C8", fontWeight: "bold", fontSize: 16 },
  titulo: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "bold",
    marginTop: 12,
  },
  subtitulo: { color: "#DCE6F1", marginTop: 6 },
  tarjeta: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    padding: 20,
    borderRadius: 14,
    alignItems: "center",
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#D8F1EF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarTexto: {
    color: "#087E8B",
    fontSize: 30,
    fontWeight: "bold",
  },
  nombre: {
    fontSize: 21,
    fontWeight: "bold",
    color: "#17365D",
    textAlign: "center",
  },
  dato: { color: "#667085", marginTop: 6 },
  botonCV: {
    backgroundColor: "#087E8B",
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
    alignItems: "center",
  },
  seccion: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 18,
    borderRadius: 14,
  },
  tituloSeccion: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#17365D",
    marginBottom: 10,
  },
  subtituloSeccion: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#17365D",
    marginTop: 14,
  },
  nombreVacante: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#087E8B",
  },
  contenido: {
    color: "#475467",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 4,
  },
  boton: {
    backgroundColor: "#087E8B",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 16,
  },
  textoBoton: { color: "#FFFFFF", fontWeight: "bold" },
  deshabilitado: { opacity: 0.6 },
  resultado: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#EAECF0",
    paddingTop: 16,
  },
  puntuacion: {
    color: "#087E8B",
    fontSize: 36,
    fontWeight: "bold",
    marginBottom: 10,
  },
  barraFondo: {
    height: 9,
    borderRadius: 8,
    backgroundColor: "#E4E7EC",
    overflow: "hidden",
    marginBottom: 14,
  },
  barraProgreso: {
    height: "100%",
    backgroundColor: "#087E8B",
  },
  aviso: { color: "#667085", fontSize: 12, marginTop: 16 },
});