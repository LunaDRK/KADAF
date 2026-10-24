import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity
} from 'react-native';
import { supabase } from '../services/supabase';

type Vacante = {
  id: string;
  titulo: string;
  empresa: string;
  salario: number;
  ubicacion: string | null;
  descripcion: string | null;
  requisitos: string[] | null;
  activa: boolean | null;
  created_at: string;
};

const COLORES = {
  fondo: '#F3F6FA',
  azul: '#17365D',
  azulClaro: '#D8F1EF',
  texto: '#17365D',
  secundario: '#667085',
  blanco: '#FFFFFF',
  borde: '#DFE4EE',
  verde: '#16794B',
  rojo: '#B42318',
};

export default function GestionVacantesScreen({ navigation }: { navigation: any }) {
  const [vacantes, setVacantes] = useState<Vacante[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [vacanteEditandoId, setVacanteEditandoId] = useState<string | null>(null);
  const [operacionId, setOperacionId] = useState<string | null>(null);
  const [vacanteDetalle, setVacanteDetalle] = useState<Vacante | null>(null);
  const [vacantePorEliminar, setVacantePorEliminar] = useState<Vacante | null>(null);

  const [titulo, setTitulo] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [salario, setSalario] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [requisitos, setRequisitos] = useState('');

  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState<'error' | 'exito'>('error');

  const mostrarMensaje = (
    texto: string,
    tipo: 'error' | 'exito' = 'error',
  ) => {
    setMensaje(texto);
    setTipoMensaje(tipo);
  };

  const cargarVacantes = useCallback(async () => {
    setCargando(true);
    setMensaje('');
    
    try {
      const { data, error } = await supabase
        .from('vacantes')
        .select(
          'id, titulo, empresa, salario, ubicacion, descripcion, requisitos, activa, created_at',
        )
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error al cargar vacantes:', error);
        mostrarMensaje(
          `No se pudieron cargar las vacantes: ${error.message}`,
        );
        return;
      }

      setVacantes((data ?? []) as Vacante[]);
    } catch (error) {
      console.error('Error inesperado al cargar vacantes:', error);
      mostrarMensaje(
        'Ocurrió un error de conexión al consultar las vacantes.',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarVacantes();
  }, [cargarVacantes]);

  const limpiarFormulario = () => {
    setTitulo('');
    setEmpresa('');
    setSalario('');
    setUbicacion('');
    setDescripcion('');
    setRequisitos('');
  };

  const abrirFormulario = () => {
    setMensaje('');
    setVacanteEditandoId(null);
    limpiarFormulario();
    setModalVisible(true);
  };

  const abrirEdicion = (vacante: Vacante) => {
    setMensaje('');
    setVacanteEditandoId(vacante.id);
    setTitulo(vacante.titulo);
    setEmpresa(vacante.empresa);
    setSalario(String(vacante.salario ?? ''));
    setUbicacion(vacante.ubicacion ?? '');
    setDescripcion(vacante.descripcion ?? '');
    setRequisitos((vacante.requisitos ?? []).join('\n'));
    setModalVisible(true);
  };

  const guardarVacante = async () => {
    console.log(vacanteEditandoId ? 'Botón Guardar cambios presionado' : 'Botón Crear presionado');

    if (guardando) {
      return;
    }

    setMensaje('');

    const tituloLimpio = titulo.trim();
    const empresaLimpia = empresa.trim();
    const salarioTexto = salario.trim().replace(',', '.');
    const salarioNumero = Number(salarioTexto);
    const listaRequisitos = requisitos.split(/\r?\n/).map(item => item.trim()).filter(Boolean);

    if (!tituloLimpio || !empresaLimpia || !salarioTexto || listaRequisitos.length === 0) {
      mostrarMensaje(
        'Completa el título, la empresa, el salario y al menos un requisito.',
      );
      return;
    }

    if (
      !Number.isFinite(salarioNumero) ||
      salarioNumero < 0
    ) {
      mostrarMensaje(
        'Escribe un salario válido. Puedes usar números y decimales.',
      );
      return;
    }

    setGuardando(true);

    try {
      console.log(
        vacanteEditandoId
          ? 'Actualizando vacante en Supabase...'
          : 'Enviando vacante a Supabase...',
      );

      const camposVacante = {
        titulo: tituloLimpio,
        empresa: empresaLimpia,
        salario: salarioNumero,
        ubicacion: ubicacion.trim() || null,
        descripcion: descripcion.trim() || null,
        requisitos: listaRequisitos,
      };

      const consulta = vacanteEditandoId
        ? supabase
            .from('vacantes')
            .update(camposVacante)
            .eq('id', vacanteEditandoId)
        : supabase
            .from('vacantes')
            .insert({
              ...camposVacante,
              activa: true,
            });

      const { data, error } = await consulta
        .select(
          'id, titulo, empresa, salario, ubicacion, descripcion, requisitos, activa, created_at',
        )
        .single();

      if (error) {
        console.error('Supabase rechazó la operación:', error);

        mostrarMensaje(
          `No se pudo ${vacanteEditandoId ? 'actualizar' : 'guardar'} la vacante. ${error.message}` +
            (error.code ? ` (Código: ${error.code})` : ''),
        );
        return;
      }

      if (!data) {
        mostrarMensaje(
          'Supabase no devolvió la vacante. Intenta nuevamente.',
        );
        return;
      }

      console.log(
        vacanteEditandoId ? 'Vacante actualizada:' : 'Vacante guardada:',
        data.id,
      );

      if (vacanteEditandoId) {
        setVacantes((actuales) =>
          actuales.map((actual) =>
            actual.id === data.id ? (data as Vacante) : actual,
          ),
        );
      } else {
        setVacantes((actuales) => [data as Vacante, ...actuales]);
      }

      limpiarFormulario();
      setVacanteEditandoId(null);
      setModalVisible(false);
      mostrarMensaje(
        vacanteEditandoId
          ? '¡La vacante se actualizó correctamente!'
          : '¡La vacante se guardó correctamente!',
        'exito',
      );
    } catch (error) {
      console.error('Error inesperado al guardar:', error);

      const detalle =
        error instanceof Error ? error.message : String(error);

      mostrarMensaje(
        `Ocurrió un error al guardar. ${detalle}`,
      );
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstadoVacante = async (vacante: Vacante) => {
    if (operacionId) return;
    setMensaje('');
    setOperacionId(vacante.id);

    try {
      const nuevoEstado = !vacante.activa;
      const { data, error } = await supabase
        .from('vacantes')
        .update({ activa: nuevoEstado })
        .eq('id', vacante.id)
        .select('id, titulo, empresa, salario, ubicacion, descripcion, requisitos, activa, created_at')
        .single();

      if (error) {
        mostrarMensaje(`No se pudo cambiar el estado. ${error.message}`);
        return;
      }

      setVacantes((actuales) => actuales.map((item) => item.id === vacante.id ? data as Vacante : item));
      mostrarMensaje(nuevoEstado ? 'La vacante está activa.' : 'La vacante está desactivada.', 'exito');
    } catch (error) {
      mostrarMensaje(`Ocurrió un error al cambiar el estado: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setOperacionId(null);
    }
  };

  const eliminarVacante = (vacante: Vacante) => {
    setMensaje('');
    setVacantePorEliminar(vacante);
  };

  const confirmarEliminacion = async () => {
    const vacante = vacantePorEliminar;
    if (!vacante || operacionId) return;

    setOperacionId(vacante.id);
    setMensaje('');

    try {
      const { data, error } = await supabase
        .from('vacantes')
        .delete()
        .eq('id', vacante.id)
        .select('id')
        .maybeSingle();

      if (error) {
          if (error.code === '23503') {
            mostrarMensaje(
              'Esta vacante tiene postulaciones registradas. No se puede eliminar definitivamente. Puedes desactivarla para conservar el historial.'
            );
            setVacantePorEliminar(null);
            return;
          }
        
          console.error('Error al eliminar vacante:', error);
          mostrarMensaje(
            `No se pudo eliminar la vacante. ${error.message}`
          );
          return;
        }        

      if (!data) {
        mostrarMensaje('Supabase no eliminó ninguna fila. Revisa la política DELETE de RLS para la tabla vacantes.');
        return;
      }

      setVacantes((actuales) => actuales.filter((item) => item.id !== vacante.id));
      setVacantePorEliminar(null);
      mostrarMensaje('La vacante se eliminó correctamente.', 'exito');
    } catch (error) {
      mostrarMensaje(`Ocurrió un error al eliminar: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setOperacionId(null);
    }
  };

  const vacantesFiltradas = vacantes.filter((vacante) => {
    const termino = busqueda.trim().toLowerCase();

    return (
      vacante.titulo.toLowerCase().includes(termino) ||
      vacante.empresa.toLowerCase().includes(termino) ||
      (vacante.ubicacion ?? '').toLowerCase().includes(termino)
    );
  });

  const verDetalle = (vacante: Vacante) => {
    setVacanteDetalle(vacante);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORES.azul} />

      <View style={styles.encabezado}>
        <Text style={styles.logo}>KADAF</Text>
        <Text style={styles.subtituloEncabezado}>
          Panel de administración
        </Text>
      </View>

      <ScrollView
        style={styles.contenido}
        contentContainerStyle={styles.contenidoInterior}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.tituloFila}>
          <View style={styles.tituloBloque}>
            <Text style={styles.tituloPagina}>Gestión de vacantes</Text>
            <Text style={styles.textoSecundario}>
              Administra las oportunidades laborales.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={abrirFormulario}
            style={({ pressed }) => [
              styles.botonCrear,
              pressed && styles.botonPresionado,
            ]}
          >
            <Text style={styles.textoBotonCrear}>+ Nueva</Text>
          </Pressable>
        </View>

        {mensaje !== '' && !modalVisible && (
          <View
            style={[
              styles.mensaje,
              tipoMensaje === 'error'
                ? styles.mensajeError
                : styles.mensajeExito,
            ]}
          >
            <Text
              style={[
                styles.textoMensaje,
                {
                  color:
                    tipoMensaje === 'error'
                      ? COLORES.rojo
                      : COLORES.verde,
                },
              ]}
            >
              {mensaje}
            </Text>
          </View>
        )}

        <View style={styles.resumenFila}>
          <View style={[styles.resumen, styles.resumenMitad]}>
            <Text style={styles.resumenEtiqueta}>Total de vacantes</Text>
            <Text style={styles.resumenNumero}>{vacantes.length}</Text>
          </View>
          <View style={[styles.resumen, styles.resumenMitad]}>
            <Text style={styles.resumenEtiqueta}>Vacantes activas</Text>
            <Text style={[styles.resumenNumero, { color: COLORES.verde }]}>{vacantes.filter((v) => v.activa).length}</Text>
          </View>
        </View>

        <TextInput
          style={styles.buscador}
          placeholder="Buscar por título, empresa o ubicación..."
          placeholderTextColor="#8791A5"
          value={busqueda}
          onChangeText={setBusqueda}
          autoCapitalize="none"
          returnKeyType="search"
        />

        {cargando ? (
          <View style={styles.estado}>
            <ActivityIndicator size="large" color={COLORES.azul} />
            <Text style={styles.textoSecundario}>
              Cargando vacantes...
            </Text>
          </View>
        ) : vacantesFiltradas.length === 0 ? (
          <View style={styles.vacio}>
            <Text style={styles.vacioTitulo}>
              {busqueda.trim()
                ? 'No se encontraron resultados'
                : 'Todavía no hay vacantes'}
            </Text>
            <Text style={styles.textoSecundario}>
              {busqueda.trim()
                ? 'Prueba con otro término de búsqueda.'
                : 'Presiona “+ Nueva” para registrar la primera.'}
            </Text>

            {!busqueda.trim() && (
              <Pressable
                onPress={abrirFormulario}
                style={styles.botonSecundario}
              >
                <Text style={styles.textoBotonSecundario}>
                  Crear vacante
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.lista}>
            {vacantesFiltradas.map((vacante) => (
              <View key={vacante.id} style={styles.tarjeta}>
                <View style={styles.tarjetaSuperior}>
                  <View style={styles.tarjetaTitulos}>
                    <Text style={styles.vacanteTitulo}>
                      {vacante.titulo}
                    </Text>
                    <Text style={styles.empresa}>
                      {vacante.empresa}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.estadoEtiqueta,
                      vacante.activa
                        ? styles.estadoActivo
                        : styles.estadoInactivo,
                    ]}
                  >
                    <Text
                      style={[
                        styles.estadoTexto,
                        {
                          color: vacante.activa
                            ? COLORES.verde
                            : COLORES.secundario,
                        },
                      ]}
                    >
                      {vacante.activa ? 'Activa' : 'Inactiva'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.datoVacante}>
                  Salario: {formatearSalario(vacante.salario)}
                </Text>

                <Text style={styles.datoVacante}>
                  Ubicación: {vacante.ubicacion || 'No especificada'}
                </Text>

                {!!vacante.descripcion && (
                  <Text style={styles.descripcion} numberOfLines={3}>
                    {vacante.descripcion}
                  </Text>
                )}

                <View style={styles.tarjetaAcciones}>
                  <Pressable
                    onPress={() => verDetalle(vacante)}
                    style={styles.botonDetalle}
                  >
                    <Text style={styles.textoBotonDetalle}>
                      Ver detalle
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => abrirEdicion(vacante)}
                    style={styles.botonEditar}
                    disabled={!!operacionId}
                  >
                    <Text style={styles.textoBotonEditar}>Editar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => cambiarEstadoVacante(vacante)}
                    style={styles.botonEstado}
                    disabled={!!operacionId}
                  >
                    <Text style={styles.textoBotonEstado}>
                      {operacionId === vacante.id ? 'Procesando...' : vacante.activa ? 'Desactivar' : 'Activar'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => eliminarVacante(vacante)}
                    style={styles.botonEliminar}
                    disabled={!!operacionId}
                  >
                    <Text style={styles.textoBotonEliminar}>Eliminar</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!guardando) {
            setModalVisible(false);
            setVacanteEditandoId(null);
            setMensaje('');
          }
        }}
      >
        <KeyboardAvoidingView
          style={styles.fondoModal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalTarjeta}>
            <View style={styles.modalEncabezado}>
              <View>
                <Text style={styles.modalTitulo}>
                  {vacanteEditandoId ? 'Editar vacante' : 'Nueva vacante'}
                </Text>
                <Text style={styles.textoSecundario}>
                  {vacanteEditandoId
                    ? 'Modifica la información y guarda los cambios.'
                    : 'Completa la información del puesto.'}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar formulario"
                disabled={guardando}
                onPress={() => {
                  setModalVisible(false);
                  setVacanteEditandoId(null);
                  setMensaje('');
                }}
                style={styles.botonCerrar}
              >
                <Text style={styles.textoCerrar}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.formularioScroll}
              contentContainerStyle={styles.formularioContenido}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.etiqueta}>Título del puesto *</Text>
              <TextInput
                style={styles.campo}
                placeholder="Ej. Desarrollador de software"
                placeholderTextColor="#8791A5"
                value={titulo}
                onChangeText={setTitulo}
                editable={!guardando}
                returnKeyType="next"
              />

              <Text style={styles.etiqueta}>Empresa *</Text>
              <TextInput
                style={styles.campo}
                placeholder="Nombre de la empresa"
                placeholderTextColor="#8791A5"
                value={empresa}
                onChangeText={setEmpresa}
                editable={!guardando}
                returnKeyType="next"
              />

              <Text style={styles.etiqueta}>Salario numérico *</Text>
              <TextInput
                style={styles.campo}
                placeholder="Ej. 4500 o 4500.50"
                placeholderTextColor="#8791A5"
                value={salario}
                onChangeText={setSalario}
                editable={!guardando}
                keyboardType="decimal-pad"
              />

              <Text style={styles.etiqueta}>Ubicación</Text>
              <TextInput
                style={styles.campo}
                placeholder="Ej. Ciudad de Guatemala"
                placeholderTextColor="#8791A5"
                value={ubicacion}
                onChangeText={setUbicacion}
                editable={!guardando}
                returnKeyType="next"
              />

              <Text style={styles.etiqueta}>Descripción</Text>
              <TextInput
                style={[styles.campo, styles.campoDescripcion]}
                placeholder="Describe las funciones y requisitos del puesto..."
                placeholderTextColor="#8791A5"
                value={descripcion}
                onChangeText={setDescripcion}
                editable={!guardando}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.etiqueta}>Requisitos del puesto * (uno por línea)</Text>
              <TextInput
                style={[styles.campo, styles.campoDescripcion]}
                placeholder={'Ej. Manejo de Excel\nConocimientos de SQL\nTrabajo en equipo'}
                placeholderTextColor="#8791A5"
                value={requisitos}
                onChangeText={setRequisitos}
                editable={!guardando}
                multiline
                textAlignVertical="top"
              />

              {mensaje !== '' && (
                <View style={styles.mensajeError}>
                  <Text style={styles.textoError}>{mensaje}</Text>
                </View>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={guardando}
                onPress={guardarVacante}
                style={({ pressed }) => [
                  styles.botonGuardar,
                  pressed && !guardando && styles.botonPresionado,
                  guardando && styles.botonDeshabilitado,
                ]}
              >
                {guardando ? (
                  <View style={styles.filaGuardando}>
                    <ActivityIndicator color={COLORES.blanco} />
                    <Text style={styles.textoBotonGuardar}>
                      Guardando...
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.textoBotonGuardar}>
                    {vacanteEditandoId ? 'Guardar cambios' : 'Crear vacante'}
                  </Text>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={guardando}
                onPress={() => {
                  setModalVisible(false);
                  setVacanteEditandoId(null);
                  setMensaje('');
                }}
                style={styles.botonCancelar}
              >
                <Text style={styles.textoCancelar}>Cancelar</Text>
              </Pressable>

              <Text style={styles.nota}>
                * Campos obligatorios
              </Text>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={vacanteDetalle !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setVacanteDetalle(null)}
      >
        <View style={styles.fondoModal}>
          <View style={styles.modalTarjeta}>
            <View style={styles.modalEncabezado}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.modalTitulo}>Detalle de vacante</Text>
                <Text style={styles.textoSecundario}>{vacanteDetalle?.titulo}</Text>
              </View>
              <Pressable onPress={() => setVacanteDetalle(null)} style={styles.botonCerrar}>
                <Text style={styles.textoCerrar}>✕</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.detalleContenido}>
              <Text style={styles.etiqueta}>Empresa</Text>
              <Text style={styles.detalleTexto}>{vacanteDetalle?.empresa}</Text>
              <Text style={styles.etiqueta}>Salario</Text>
              <Text style={styles.detalleTexto}>{vacanteDetalle ? formatearSalario(vacanteDetalle.salario) : ''}</Text>
              <Text style={styles.etiqueta}>Ubicación</Text>
              <Text style={styles.detalleTexto}>{vacanteDetalle?.ubicacion || 'No especificada'}</Text>
              <Text style={styles.etiqueta}>Estado</Text>
              <Text style={styles.detalleTexto}>{vacanteDetalle?.activa ? 'Activa' : 'Inactiva'}</Text>
              <Text style={styles.etiqueta}>Descripción</Text>
              <Text style={styles.detalleTexto}>{vacanteDetalle?.descripcion || 'Sin descripción.'}</Text>
              <Text style={styles.etiqueta}>Requisitos</Text>
              <Text style={styles.detalleTexto}>{vacanteDetalle?.requisitos?.length ? vacanteDetalle.requisitos.map(r => '• ' + r).join('\n') : 'Sin requisitos.'}</Text>
            </ScrollView>
            <View style={styles.detalleAcciones}>
              <Pressable style={styles.botonCancelar} onPress={() => setVacanteDetalle(null)}>
                <Text style={styles.textoCancelar}>Cerrar</Text>
              </Pressable>
              {vacanteDetalle && <Pressable style={styles.botonGuardar} onPress={() => { const seleccionada = vacanteDetalle; setVacanteDetalle(null); abrirEdicion(seleccionada); }}>
                <Text style={styles.textoBotonGuardar}>Editar vacante</Text>
              </Pressable>}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={vacantePorEliminar !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setVacantePorEliminar(null)}
      >
        <View style={styles.fondoModal}>
          <View style={styles.confirmacionTarjeta}>
            <Text style={styles.modalTitulo}>¿Eliminar vacante?</Text>
            <Text style={styles.textoSecundario}>
              ¿Seguro que deseas eliminar “{vacantePorEliminar?.titulo}” de {vacantePorEliminar?.empresa}? Esta acción no se puede deshacer.
            </Text>
            <View style={styles.detalleAcciones}>
              <Pressable style={styles.botonCancelar} disabled={!!operacionId} onPress={() => setVacantePorEliminar(null)}>
                <Text style={styles.textoCancelar}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.botonEliminar, { marginLeft: 0, opacity: operacionId ? 0.6 : 1 }]} disabled={!!operacionId} onPress={confirmarEliminacion}>
                <Text style={styles.textoBotonEliminar}>{operacionId ? 'Eliminando...' : 'Sí, eliminar'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function formatearSalario(salario: number | null | undefined): string {
  if (salario === null || salario === undefined) {
    return 'No especificado';
  }

  return new Intl.NumberFormat('es-GT', {
    maximumFractionDigits: 2,
  }).format(salario);
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORES.fondo,
  },
  encabezado: {
    backgroundColor: COLORES.azul,
    paddingHorizontal: 24,
    paddingVertical: 22,
  },
  logo: {
    color: COLORES.blanco,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
  },
  subtituloEncabezado: {
    color: '#DDE5FF',
    fontSize: 13,
    marginTop: 4,
  },
  contenido: {
    flex: 1,
  },
  contenidoInterior: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 1000,
    width: '100%',
    alignSelf: 'center',
  },
  tituloFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 22,
  },
  tituloBloque: {
    flex: 1,
  },
  tituloPagina: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORES.texto,
  },
  textoSecundario: {
    fontSize: 13,
    color: COLORES.secundario,
    marginTop: 5,
    lineHeight: 19,
  },
  botonCrear: {
    backgroundColor: COLORES.azul,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBotonCrear: {
    color: COLORES.blanco,
    fontWeight: '700',
    fontSize: 14,
  },
  botonPresionado: {
    opacity: 0.75,
  },
  resumenFila: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  resumenMitad: {
    flex: 1,
    marginBottom: 0,
  },
  resumen: {
    backgroundColor: COLORES.blanco,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORES.borde,
    marginBottom: 0,
  },
  resumenEtiqueta: {
    color: COLORES.secundario,
    fontSize: 13,
  },
  resumenNumero: {
    color: COLORES.azul,
    fontSize: 30,
    fontWeight: '800',
    marginTop: 5,
  },
  buscador: {
    backgroundColor: COLORES.blanco,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 14,
    color: COLORES.texto,
    marginBottom: 18,
  },
  estado: {
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  vacio: {
    backgroundColor: COLORES.blanco,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORES.borde,
    padding: 28,
    alignItems: 'center',
  },
  vacioTitulo: {
    color: COLORES.texto,
    fontWeight: '700',
    fontSize: 17,
    textAlign: 'center',
  },
  botonSecundario: {
    marginTop: 18,
    padding: 12,
    borderRadius: 9,
    backgroundColor: COLORES.azulClaro,
  },
  textoBotonSecundario: {
    color: COLORES.azul,
    fontWeight: '700',
  },
  lista: {
    gap: 14,
  },
  tarjeta: {
    backgroundColor: COLORES.blanco,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 14,
    padding: 18,
  },
  tarjetaSuperior: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  tarjetaTitulos: {
    flex: 1,
  },
  vacanteTitulo: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORES.texto,
  },
  empresa: {
    fontSize: 14,
    color: COLORES.secundario,
    marginTop: 5,
  },
  estadoEtiqueta: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  estadoActivo: {
    backgroundColor: '#E5F6EC',
  },
  estadoInactivo: {
    backgroundColor: '#EEF0F4',
  },
  estadoTexto: {
    fontSize: 12,
    fontWeight: '700',
  },
  datoVacante: {
    color: COLORES.texto,
    fontSize: 13,
    marginTop: 6,
  },
  descripcion: {
    color: COLORES.secundario,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  tarjetaAcciones: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF0F5',
  },
  botonDetalle: {
    backgroundColor: COLORES.azulClaro,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  textoBotonDetalle: {
    color: COLORES.azul,
    fontWeight: '700',
    fontSize: 13,
  },
  botonEditar: {
    backgroundColor: '#F1F4FA',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginLeft: 8,
  },
  textoBotonEditar: {
    color: COLORES.texto,
    fontWeight: '700',
    fontSize: 13,
  },
  botonEstado: {
    backgroundColor: '#E5F6EC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 8,
  },
  textoBotonEstado: {
    color: COLORES.verde,
    fontWeight: '700',
    fontSize: 13,
  },
  botonEliminar: {
    backgroundColor: '#FEF3F2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 8,
  },
  textoBotonEliminar: {
    color: COLORES.rojo,
    fontWeight: '700',
    fontSize: 13,
  },
  detalleContenido: {
    paddingHorizontal: 22,
    paddingVertical: 18,
    gap: 6,
  },
  detalleTexto: {
    color: COLORES.texto,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  detalleAcciones: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
  },
  confirmacionTarjeta: {
    backgroundColor: COLORES.blanco,
    borderRadius: 18,
    width: '100%',
    maxWidth: 460,
    padding: 22,
    gap: 14,
  },
  fondoModal: {
    flex: 1,
    backgroundColor: 'rgba(17, 25, 45, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalTarjeta: {
    backgroundColor: COLORES.blanco,
    borderRadius: 18,
    width: '100%',
    maxWidth: 560,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  modalEncabezado: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORES.borde,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitulo: {
    color: COLORES.texto,
    fontSize: 21,
    fontWeight: '800',
  },
  botonCerrar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: COLORES.fondo,
  },
  textoCerrar: {
    fontSize: 17,
    color: COLORES.secundario,
  },
  formularioScroll: {
    flexShrink: 1,
  },
  formularioContenido: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 24,
  },
  etiqueta: {
    color: COLORES.texto,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
    marginTop: 13,
  },
  campo: {
    backgroundColor: COLORES.blanco,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORES.texto,
  },
  campoDescripcion: {
    minHeight: 100,
    paddingTop: 12,
  },
  botonGuardar: {
    backgroundColor: COLORES.azul,
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 50,
  },
  botonDeshabilitado: {
    opacity: 0.7,
  },
  filaGuardando: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  textoBotonGuardar: {
    color: COLORES.blanco,
    fontWeight: '800',
    fontSize: 15,
  },
  botonCancelar: {
    padding: 13,
    alignItems: 'center',
    marginTop: 5,
  },
  textoCancelar: {
    color: COLORES.secundario,
    fontWeight: '700',
    fontSize: 14,
  },
  nota: {
    fontSize: 12,
    color: COLORES.secundario,
    marginTop: 5,
    textAlign: 'center',
  },
  mensaje: {
    padding: 13,
    borderRadius: 9,
    marginBottom: 16,
    borderWidth: 1,
  },
  mensajeError: {
    backgroundColor: '#FEF3F2',
    borderColor: '#FECDCA',
    padding: 12,
    borderRadius: 9,
    marginTop: 12,
    marginBottom: 10,
  },
  mensajeExito: {
    backgroundColor: '#E8F7EE',
    borderColor: '#A6E2BC',
  },
  textoMensaje: {
    fontSize: 13,
    lineHeight: 19,
  },
  textoError: {
    color: COLORES.rojo,
    fontSize: 13,
    lineHeight: 19,
  },
});
