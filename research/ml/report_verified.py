#!/usr/bin/env python3
"""Describe the small timestamped supplementary dataset and paired 401 errors."""
import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import confusion_matrix
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'evidence'/'verified'
OUT=ROOT/'ml'/'verified_results'
LABELS=['norm','fault','attack']


def main():
    prep=json.loads((DATA/'preparation.json').read_text(encoding='utf-8'))
    scores=pd.read_csv(OUT/'macro_f1_by_split.csv')
    predictions=pd.read_csv(OUT/'predictions.csv.gz')
    repro_path=OUT/'reproducibility.json'
    repro=json.loads(repro_path.read_text(encoding='utf-8')) if repro_path.exists() else None
    if repro and repro.get('same_keys') and not any(repro.get('different_by_model',{}).values()):
        reproducibility=(f"Повторный запуск на той же машине с теми же зависимостями, разбиениями и seed совпал по всем "
                         f"{repro['total_rows']} предсказаниям; время не сравнивалось. Это не доказывает идентичность на другой аппаратуре.")
    else:
        reproducibility='Повторяемость сохранённых предсказаний отдельно не подтверждена.'
    coverage_path=OUT/'fallback_coverage.json'
    if coverage_path.exists():
        coverage=json.loads(coverage_path.read_text(encoding='utf-8'))
        count=coverage.get('metric_counts',{}).get('rps_401_403',{}).get('zero_from_fallback_or_absent_code',0)
        up=coverage.get('exporter_up',{})
        fallback_note=(f'Дополнительная проверка без подстановки нулей: проверены up для {len(up)} экспортёров; '
            f'в {count} точках 401/403 равнялся нулю из fallback при отсутствии исходной серии. '
            'Это может быть нормальным отсутствием такого кода, а не отказом экспортера. Детали — `verified_results/fallback_coverage.json`.')
    else:
        fallback_note='Дополнительная проверка подстановки нулей ещё не проведена.'
    lines=['# Дополнительный эксперимент: проверенные интервалы и пара 401','',
      '**Это небольшой синтетический контроль на одном стенде.** Классы задаются сценарием, '
      'а не устанавливают реальные намерения клиента или переносимость на другие приложения.','',
      'Для каждой метрики сохранены временные метки и исходные серии; включены только успешно завершённые Job, '
      'прошедшие проверки HTTP-ответов и количества сброшенных итераций. Первые 235 секунд исключены с учётом истории и lookback.', '',
      'Это timestamps вычисления Prometheus query_range, а не времена исходных scrape отдельных счётчиков. '
      'Сохранены результаты PromQL с выражениями, а не полный архив сырых счётчиков; состояние системы может сохраняться от предыдущего прогона.', '',
      fallback_note, '',
      reproducibility, '',
      f"Число окон по классам: `{prep['windows_by_class']}`. Прогонов по сценариям: `{prep['runs_by_scenario']}`.", '',
      '## Сравнение моделей','',
      'Macro-F1, среднее ± std по пяти групповым разбиениям после усреднения трёх seed внутри разбиения.', '',
      '| Модель | 50% | 75% | 100% |','|---|---:|---:|---:|']
    for model in ['rules','rf','mlp','transformer']:
        vals=[]
        for fraction in [.5,.75,1.]:
            row=scores[(scores.model==model)&(scores.fraction==fraction)&(~scores.temporal)].iloc[0]
            vals.append(f'{row["mean"]:.3f} ± {row["std"]:.3f}')
        lines.append(f'| {model} | '+' | '.join(vals)+' |')
    lines += ['', '![Кривые обучения](verified_results/learning_curves.png)','',
      '## Пара одинаковых 401','',
      'Оба профиля отправляли 10 запросов/с на один `/api/auth/login` к синтетическому адресу `.invalid`. '
      'Профиль ошибки клиента повторял один неверный пароль; профиль имитации перебора менял пароль той же длины. '
      'Тела запросов и идентификаторы сценария не входят в признаки моделей.','',
      '| Модель | fault → attack | attack → fault | fault → norm | attack → norm |',
      '|---|---:|---:|---:|---:|']
    p=predictions[(predictions.fraction==1)&(~predictions.temporal)]
    for model in ['rules','rf','mlp','transformer']:
        g=p[p.model==model]
        def rate(actual,guess):
            subset=g[g.truth==actual]
            return (subset.prediction==guess).mean() if len(subset) else float('nan')
        lines.append(f'| {model} | {rate("fault","attack"):.3f} | {rate("attack","fault"):.3f} | '
                     f'{rate("fault","norm"):.3f} | {rate("attack","norm"):.3f} |')
    fig, axes = plt.subplots(1,3,figsize=(11,3.5))
    for ax,model in zip(axes,['rf','mlp','transformer']):
        g=predictions[(predictions.model==model)&(predictions.fraction==1)&(predictions.split==0)&(predictions.seed==0)]
        cm=confusion_matrix(g.truth,g.prediction,labels=LABELS)
        ax.imshow(cm,cmap='Blues'); ax.set_title(model)
        ax.set_xticks(range(3),LABELS,rotation=30); ax.set_yticks(range(3),LABELS)
        for i in range(3):
            for j in range(3): ax.text(j,i,str(cm[i,j]),ha='center',va='center',
                                       color='white' if cm[i,j] > cm.max()/2 else 'black')
    fig.tight_layout();fig.savefig(OUT/'confusion_split0.png',dpi=160);plt.close(fig)
    lines += ['', 'Доли объединяют окна по пяти разбиениям и трём seed; окна перекрываются, прогоны повторяются между разбиениями. '
      'Они не являются независимыми наблюдениями и не оценивают частоты инцидентов в эксплуатации. '
      'Для части запусков MLP достиг лимита итераций без сходимости. '
      'Составы прогонов, предсказания, метрики и времена сохранены в `verified_results/`.', '',
      '![Матрицы ошибок одного разбиения](verified_results/confusion_split0.png)', '',
      'Контрольные профили нормальной нагрузки обращаются к другому endpoint (`/api/auth/me`), '
      'поэтому класс нормальной нагрузки всё ещё может иметь shortcut. В одном кластере нельзя '
      'установить переносимость на другие приложения и среды. Повторы выполнялись последовательно '
      'без подтверждения полного восстановления состояния HPA; эффект временного дрейфа и порядка не исключён.', '',
      'Два сценария 401 различаются только в содержимом перебираемых паролей; '
      'агрегированные метрики могут не содержать информации, необходимой для определения намерения. '
      'Результат следует интерпретировать как проверку наблюдаемости на этом стенде.']
    (ROOT/'ml'/'VERIFIED_RESULTS.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print('VERIFIED_RESULTS.md written')


if __name__=='__main__':main()
